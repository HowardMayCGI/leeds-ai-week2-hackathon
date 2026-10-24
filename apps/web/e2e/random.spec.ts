import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('generates through the local API and has no automated accessibility violations', async ({ page }) => {
  await page.goto('/random/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Random number generator');
  const responsePromise = page.waitForResponse('/api/random');
  await page.getByRole('button', { name: 'Generate number' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const { number } = await response.json();
  expect(Number.isInteger(number) && number >= 1 && number <= 100).toBe(true);
  await expect(page.getByRole('status')).toContainText(`Your number is ${number}`);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('reports API errors and allows keyboard retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/random', async route => {
    requests++;
    if (requests === 1) await route.fulfill({ status: 503, body: '{}' });
    else await route.fulfill({ status: 200, contentType: 'application/json', body: '{"number":100}' });
  });
  await page.goto('/random/');
  const button = page.getByRole('button', { name: 'Generate number' });
  await button.focus();
  await page.keyboard.press('Enter');
  const error = page.getByRole('alert', { name: 'We could not generate a number' });
  await expect(error).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Your number is 100');
  await expect(error).toHaveCount(0);
});

test('announces a pending request and ignores repeated clicks', async ({ page }) => {
  let complete!: () => void;
  const gate = new Promise<void>(resolve => { complete = resolve; });
  let requests = 0;
  await page.route('**/api/random', async route => {
    requests++;
    await gate;
    await route.fulfill({ contentType: 'application/json', body: '{"number":1}' });
  });
  await page.goto('/random/');
  const button = page.getByRole('button', { name: 'Generate number' });
  await button.click();
  await expect(page.getByRole('status')).toContainText('Generating your number');
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await button.focus();
  await page.keyboard.press('Enter');
  complete();
  await expect(page.getByRole('status')).toContainText('Your number is 1');
  expect(requests).toBe(1);
});
