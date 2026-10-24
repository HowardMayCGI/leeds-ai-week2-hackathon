import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Walkthrough checks from the agreed meds-scheduler design (24 October 2026).

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).include('.phone-screen').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
}

const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue', exact: true });

async function startJourney(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Organise your medicines around your day');
  await page.getByRole('button', { name: 'Get started' }).click();
}

async function enterRoutine(page: Page, { skipLunch = true } = {}) {
  await page.getByLabel('What time do you usually wake up?').fill('07:00');
  await page.getByLabel('What time do you usually go to sleep?').fill('22:30');
  await continueButton(page).click();
  await page.getByLabel('What time do you usually have breakfast?').fill('08:00');
  if (skipLunch) await page.locator('#lunch-skipped').check();
  else await page.getByLabel('What time do you usually have lunch?').fill('13:00');
  await page.getByLabel('What time do you usually have your evening meal?').fill('18:30');
  await continueButton(page).click();
}

async function addIron(page: Page) {
  await page.getByRole('button', { name: 'Add a medicine or supplement' }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('ferous sulph');
  await page.getByRole('listbox').getByRole('option', { name: /Ferrous sulfate/ }).click();
  await page.getByLabel('How much do you take each time?').fill('1 tablet');
  await page.getByRole('radio', { name: 'Once a day' }).check();
  await page.getByRole('button', { name: 'Add to my list' }).click();
}

async function saveFirstSchedule(page: Page) {
  await startJourney(page);
  await enterRoutine(page);
  for (const name of [/Levothyroxine/, /Metformin/, /Amlodipine/, /Atorvastatin/]) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();
  await addIron(page);
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await page.getByRole('button', { name: 'Save my schedule' }).click();
  await expect(page.getByRole('heading', { name: 'Your schedule has been saved' })).toBeVisible();
}

test('completes the first-time journey with deliberate selections, an added medicine and a skipped meal', async ({ page }) => {
  await startJourney(page);
  await expectAccessible(page);

  // Questions come from the FHIR Questionnaire, with inline errors and a summary.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your waking and sleeping times');
  await continueButton(page).click();
  const summary = page.locator('.nhsuk-error-summary');
  await expect(summary).toContainText('Enter the time you usually wake up');
  await expect(summary).toBeFocused();
  await page.getByLabel('What time do you usually wake up?').fill('07:00');
  await page.getByLabel('What time do you usually go to sleep?').fill('22:30');
  await continueButton(page).click();

  // A skipped meal needs no time; an unanswered one does.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your meal times');
  await page.getByLabel('What time do you usually have breakfast?').fill('08:00');
  await page.locator('#lunch-skipped').check();
  await expect(page.getByLabel('What time do you usually have lunch?')).toHaveCount(0);
  await continueButton(page).click();
  await expect(page.locator('.nhsuk-error-summary')).toContainText('Enter the time you usually have your evening meal');
  await page.getByLabel('What time do you usually have your evening meal?').fill('18:30');
  await expectAccessible(page);
  await continueButton(page).click();

  // Record medicines start unchecked and show recorded instructions read-only.
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(5);
  for (const box of await checkboxes.all()) await expect(box).not.toBeChecked();
  await expect(page.getByText('Take in the morning on an empty stomach, at least 30 minutes before breakfast')).toBeVisible();
  await expectAccessible(page);
  for (const name of [/Levothyroxine/, /Metformin/, /Atorvastatin/]) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();

  // Add anything missing: fuzzy search, explicit selection, and an unlinked manual entry.
  await addIron(page);
  await page.getByRole('button', { name: 'Add another medicine or supplement' }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('Lipitor');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('listbox')).toContainText('Brand: Lipitor');
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('Turmeric');
  await expect(page.getByRole('listbox')).toContainText('No matches found');
  await page.getByRole('button', { name: 'I cannot find it in the list' }).click();
  await page.getByLabel('Strength').fill('500mg');
  await page.getByLabel('How much do you take each time?').fill('1 capsule');
  await page.getByRole('radio', { name: 'Once a day' }).check();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Add to my list' }).click();
  await expect(page.getByText('Not matched to our list')).toBeVisible();
  await expectAccessible(page);
  await continueButton(page).click();

  // Check answers shows everything, with Change links.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(page.getByText('You do not usually eat this meal')).toBeVisible();
  await expect(page.locator('.nhsuk-summary-list').nth(1)).toContainText('Amlodipine 5mg tablets');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create my schedule' }).click();

  // A chronological proposal, clearly not yet saved.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your proposed schedule/);
  await expect(page.getByText('Proposal – not saved')).toBeVisible();
  const times = await page.locator('.app-slot__time').allTextContents();
  expect(times).toEqual(['7am', '8am', '6:30pm']);
  await expect(page.locator('.app-slot').filter({ hasText: '6:30pm' })).toContainText('Ferrous sulfate');
  await expect(page.locator('.app-not-timed')).toContainText('Turmeric');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Save my schedule' }).click();

  // Reminders default ON, but are not shown as working without permission.
  await expect(page.getByRole('heading', { name: 'Your schedule has been saved' })).toBeVisible();
  const reminderSwitch = page.getByRole('switch', { name: 'Medicine reminders' });
  await expect(reminderSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.app-reminder-status')).toContainText('Waiting for permission');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Allow notifications' }).click();
  const prompt = page.getByRole('dialog', { name: 'Allow LAI App to send you notifications?' });
  await expect(prompt).toContainText('Demo permission request');
  await prompt.getByRole('button', { name: 'Do not allow' }).click();
  await expect(page.locator('.app-reminder-status')).toContainText('Notifications are not allowed');
  await page.getByRole('button', { name: 'Ask for permission again (demo)' }).click();
  await prompt.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.locator('.app-reminder-status')).toContainText('Reminders are on');
  await expect(page.locator('.app-reminder-status')).toContainText('does not send real notifications');
  await reminderSwitch.click();
  await expect(reminderSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.app-reminder-status')).toContainText('Reminders are off');
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your medicine schedule/);
  await expectAccessible(page);
});

test('changing the routine creates a replacement proposal that only replaces the saved schedule once saved', async ({ page }) => {
  await saveFirstSchedule(page);
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(page.locator('.app-slot__time').first()).toHaveText('7am');

  await page.getByRole('link', { name: 'Change my routine' }).click();
  await expect(page.getByLabel('What time do you usually wake up?')).toHaveValue('07:00');
  await continueButton(page).click();
  await page.getByLabel('What time do you usually have breakfast?').fill('09:00');
  await continueButton(page).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(page.locator('.nhsuk-summary-list').first()).toContainText('9am');
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your updated proposed schedule/);
  await expect(page.getByText('Your saved schedule stays the same until you save this one.')).toBeVisible();
  await expect(page.locator('.app-slot__time').first()).toHaveText('8am');

  // Leaving without saving keeps the original schedule.
  await page.getByRole('link', { name: 'Keep my saved schedule without changes' }).click();
  await expect(page.locator('.app-slot__time').first()).toHaveText('7am');

  // Change links on check answers return straight to the review page without repeating other sections.
  await page.getByRole('link', { name: 'Change my routine' }).click();
  await continueButton(page).click();
  await continueButton(page).click();
  await page.getByRole('link', { name: 'Change meal times' }).click();
  await page.getByLabel('What time do you usually have breakfast?').fill('09:00');
  await continueButton(page).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await page.getByRole('button', { name: 'Save my schedule' }).click();
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(page.locator('.app-slot__time').first()).toHaveText('8am');
});

test('switching language mid-journey keeps answers and selections, with right-to-left Urdu', async ({ page }) => {
  await startJourney(page);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: /Levothyroxine/ }).check();

  const language = page.locator('#language-select');
  await language.selectOption('pl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Które leki chcesz uwzględnić?');
  await expect(page.getByRole('checkbox', { name: /Levothyroxine/ })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  // Recorded instructions stay in their supplied wording and are labelled as untranslated.
  await expect(page.getByText('Po angielsku, tak jak w dokumentacji')).toBeVisible();
  await expect(page.getByText('Take with or just after food')).toBeVisible();

  await language.selectOption('ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('آپ کون سی دوائیں شامل کرنا چاہتے ہیں؟');
  await expect(page.locator('bdi[lang="en"]', { hasText: 'Levothyroxine' })).toHaveAttribute('dir', 'ltr');
  await expectAccessible(page);

  await page.getByRole('button', { name: 'جاری رکھیں' }).click();
  await page.getByRole('button', { name: 'میرے پاس شامل کرنے کو کچھ نہیں' }).click();
  await language.selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(page.locator('.nhsuk-summary-list').first()).toContainText('7am');
  await expect(page.locator('.nhsuk-summary-list').nth(1)).toContainText('Levothyroxine 50 micrograms tablets');

  // Urdu layout with medicine names, numbers and times together.
  await language.selectOption('ur');
  await page.getByRole('button', { name: 'میرا شیڈول بنائیں' }).click();
  const firstTime = page.locator('.app-slot__time').first();
  await expect(firstTime.locator('bdi')).toHaveAttribute('dir', 'ltr');
  await expect(firstTime).toContainText('7:00');
  await expectAccessible(page);

  // The preference is remembered on the device.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('نسخے');
});

test('a demo pharmacist review leaves the saved schedule usable, and returning users go straight to it', async ({ page }) => {
  await saveFirstSchedule(page);
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await page.getByRole('button', { name: 'Request a pharmacist review' }).click();
  await expect(page.getByText('Demo request', { exact: true })).toBeVisible();
  await expect(page.getByText('has not been sent to a pharmacist')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Back to my schedule' }).click();
  await expect(page.getByText(/Demo request made on/)).toBeVisible();
  await expect(page.locator('.app-slot').first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: /View your saved schedule/ })).toBeVisible();
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your medicine schedule/);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
});

test('explains instead of producing a schedule when instructions cannot be met', async ({ page }) => {
  await startJourney(page);
  await page.getByLabel('What time do you usually wake up?').fill('07:00');
  await page.getByLabel('What time do you usually go to sleep?').fill('22:30');
  await continueButton(page).click();
  await page.locator('#breakfast-skipped').check();
  await page.locator('#lunch-skipped').check();
  await page.getByLabel('What time do you usually have your evening meal?').fill('18:30');
  await continueButton(page).click();
  await page.getByRole('checkbox', { name: /Metformin/ }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'I have nothing to add' }).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('We cannot create a schedule with these answers');
  await expect(page.getByText(/Metformin needs to be taken with food 2 times a day/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save my schedule' })).toHaveCount(0);
  await expectAccessible(page);
});
