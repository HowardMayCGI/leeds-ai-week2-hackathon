import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Shared steps for the Schedule my medicines walkthrough tests, using the
// patient records served by the local API from test_data/.

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
}

// Lilliana, Gene and Raylene have their usual day filled in; Carri does not.
export const LILLIANA = 'Lilliana Kimbra Lockman';
export const GENE = 'Gene Orval Witting';
export const CARRI = 'Carri Dianna Cartwright';

export const app = (page: Page) => page.locator('.app-root');
export const heading = (page: Page) => page.getByRole('heading', { level: 1 });
export const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue', exact: true });
export const doseTimes = (page: Page) => page.locator('.app-timeline__item--doses .app-time');
export const timelineAt = (page: Page, time: string) => page.locator('.nhsapp-timeline__item').filter({ has: page.locator('.app-timeline__time', { hasText: new RegExp(`^${time}`) }) });

/** Enters a 12-hour time: hour, minutes and am or pm. */
export async function enterTime(page: Page, linkId: string, hour: string, minutes: string, period: 'am' | 'pm') {
  await page.locator(`#${linkId}`).fill(hour);
  await page.locator(`#${linkId}-minutes`).fill(minutes);
  await page.locator(`#${linkId}-${period}`).check();
}

/** Opens the web page, chooses the patient and waits for their record to load. */
export async function openFor(page: Page, patient = LILLIANA) {
  await page.goto('/');
  await page.getByLabel('Patient').selectOption({ label: patient });
  await expect(page.getByRole('link', { name: /Schedule my medicines/ })).toBeVisible();
}

export async function startJourney(page: Page, patient = LILLIANA) {
  await openFor(page, patient);
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await expect(heading(page)).toContainText('Organise your medicines around your day');
  await page.getByRole('button', { name: 'Get started' }).click();
}

export async function enterRoutine(page: Page, { skipLunch = false } = {}) {
  await enterTime(page, 'wake-time', '7', '00', 'am');
  await enterTime(page, 'sleep-time', '10', '30', 'pm');
  await continueButton(page).click();
  await enterTime(page, 'breakfast-time', '8', '00', 'am');
  if (skipLunch) await page.locator('#lunch-skipped').check();
  else await enterTime(page, 'lunch-time', '1', '00', 'pm');
  await enterTime(page, 'dinner-time', '6', '30', 'pm');
  await continueButton(page).click();
}

/** Adds a medicine found by search. Suggestions come from every patient's record. */
export async function addMedicine(page: Page, search: string, option: RegExp, timing: string, frequency = 'Once a day') {
  await page.getByRole('button', { name: /^Add (another|a) medicine or supplement$/ }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill(search);
  await page.getByRole('listbox').getByRole('option', { name: option }).click();
  await page.getByLabel('Amount').fill('1');
  await page.getByRole('radio', { name: frequency, exact: true }).check();
  await page.getByRole('radio', { name: timing }).check();
  await page.getByRole('button', { name: 'Add to my list' }).click();
}

export async function saveFirstSchedule(page: Page, patient = LILLIANA) {
  await startJourney(page, patient);
  await enterRoutine(page);
  for (const name of [/^Lisinopril/, /^Oxycodone/]) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'I have nothing to add' }).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await page.getByRole('button', { name: 'Save my schedule' }).click();
  await expect(page.getByRole('heading', { name: 'Your schedule has been saved' })).toBeVisible();
}
