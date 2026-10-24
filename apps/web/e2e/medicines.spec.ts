import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Walkthrough checks from the agreed meds-scheduler design (24 October 2026).

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
}

const app = (page: Page) => page.locator('.app-root');
const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue', exact: true });
const doseTimes = (page: Page) => page.locator('.app-timeline__item--doses .app-time');

/** Enters a 12-hour time: hour, minutes and am or pm. */
async function enterTime(page: Page, linkId: string, hour: string, minutes: string, period: 'am' | 'pm') {
  await page.locator(`#${linkId}`).fill(hour);
  await page.locator(`#${linkId}-minutes`).fill(minutes);
  await page.locator(`#${linkId}-${period}`).check();
}

async function startJourney(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Organise your medicines around your day');
  await page.getByRole('button', { name: 'Get started' }).click();
}

async function enterRoutine(page: Page, { skipLunch = true } = {}) {
  await enterTime(page, 'wake-time', '7', '00', 'am');
  await enterTime(page, 'sleep-time', '10', '30', 'pm');
  await continueButton(page).click();
  await enterTime(page, 'breakfast-time', '8', '00', 'am');
  if (skipLunch) await page.locator('#lunch-skipped').check();
  else await enterTime(page, 'lunch-time', '1', '00', 'pm');
  await enterTime(page, 'dinner-time', '6', '30', 'pm');
  await continueButton(page).click();
}

async function addIron(page: Page) {
  await page.getByRole('button', { name: 'Add a medicine or supplement' }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('ferous sulph');
  await page.getByRole('listbox').getByRole('option', { name: /Ferrous sulfate/ }).click();
  await page.getByLabel('Amount').fill('1');
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

test('completes the first-time journey with deliberate selections, added medicines and a skipped meal', async ({ page }) => {
  await startJourney(page);
  await expectAccessible(page);

  // Questions come from the FHIR Questionnaire. Times are entered as hour, minutes and am or pm.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your waking and sleeping times');
  await expect(page.getByText('12pm is midday and 12am is midnight').first()).toBeVisible();
  await page.locator('#wake-time').fill('7');
  await continueButton(page).click();
  const summary = page.locator('.nhsuk-error-summary');
  await expect(summary).toBeFocused();
  await expect(summary).toContainText('Select am or pm');
  await expect(summary).toContainText('Enter the time you usually go to sleep');
  await page.locator('#wake-time').fill('13');
  await page.locator('#wake-time-am').check();
  await continueButton(page).click();
  await expect(summary).toContainText('Enter an hour from 1 to 12');
  await page.locator('#wake-time').fill('7');
  await enterTime(page, 'sleep-time', '10', '30', 'pm');
  await expectAccessible(page);
  await continueButton(page).click();

  // A skipped meal needs no time; an unanswered one does.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your meal times');
  await enterTime(page, 'breakfast-time', '8', '', 'am');
  await page.locator('#lunch-skipped').check();
  await expect(page.locator('#lunch-time')).toHaveCount(0);
  await continueButton(page).click();
  await expect(summary).toContainText('Enter the time you usually have your evening meal');
  await enterTime(page, 'dinner-time', '6', '30', 'pm');
  await expectAccessible(page);
  await continueButton(page).click();

  // Record medicines are NHS checkboxes, all unchecked, with an exclusive "None of these".
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(6);
  for (const box of await checkboxes.all()) await expect(box).not.toBeChecked();
  await expect(page.getByText('1 tablet (50 micrograms)')).toBeVisible();
  await expect(page.getByText('1 or 2 tablets (500mg each)')).toBeVisible();
  await continueButton(page).click();
  await expect(summary).toContainText('Select the medicines you want to include, or select none of these');
  await page.getByRole('checkbox', { name: /Amlodipine/ }).check();
  await page.getByRole('checkbox', { name: 'None of these' }).check();
  await expect(page.getByRole('checkbox', { name: /Amlodipine/ })).not.toBeChecked();
  await expectAccessible(page);
  for (const name of [/Levothyroxine/, /Metformin/, /Atorvastatin/]) await page.getByRole('checkbox', { name }).check();
  await expect(page.getByRole('checkbox', { name: 'None of these' })).not.toBeChecked();
  await continueButton(page).click();

  // Add anything missing: fuzzy search, explicit selection, and an unmatched manual entry.
  await addIron(page);
  await page.getByRole('button', { name: 'Add another medicine or supplement' }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('Lipitor');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('listbox')).toContainText('Brand: Lipitor');
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('Turmeric');
  await expect(page.getByRole('listbox')).toContainText('No matches found');
  await page.getByRole('button', { name: 'I cannot find it in the list' }).click();
  await expect(page.locator('#addition-manual-name')).toBeFocused();
  await page.getByLabel('Strength of each tablet, capsule or dose').fill('500mg');
  await page.getByLabel('Amount').fill('2');
  await page.getByRole('button', { name: 'Add to my list' }).click();
  await expect(summary).toContainText('Select what you take, such as tablets or capsules');
  await page.getByRole('radio', { name: 'Capsules' }).check();
  await page.getByRole('radio', { name: 'Twice a day' }).check();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Add to my list' }).click();
  await expect(page.getByText('Not matched to our list')).toBeVisible();
  await expect(page.getByText('2 capsules (500mg each)')).toBeVisible();
  await expectAccessible(page);
  await continueButton(page).click();

  // Check answers shows every answer, each with its own Change link.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(page.getByText('You do not usually eat this meal')).toBeVisible();
  await expect(page.locator('.nhsuk-summary-list').nth(1)).toContainText('Amlodipine 5mg');
  await expect(page.getByRole('link', { name: /^Change/ })).toHaveCount(9);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create my schedule' }).click();

  // A chronological proposal with the patient's day, clearly not yet saved, and every medicine timed.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your proposed schedule/);
  await expect(page.getByText('Not saved yet')).toBeVisible();
  await expect(page.locator('.app-timeline__time .app-time')).toHaveText(['7am', '8am', '6:30pm', '10:30pm']);
  await expect(page.locator('.app-timeline__event')).toHaveText(['You wake up', 'Breakfast', 'Evening meal', 'You go to sleep']);
  await expect(page.locator('.nhsapp-timeline__item').filter({ hasText: '6:30pm' })).toContainText('Ferrous sulfate');
  await expect(page.locator('.nhsapp-timeline__item').filter({ hasText: 'Turmeric' })).toHaveCount(2);
  await expect(page.locator('.app-when-needed')).toHaveCount(0);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Save my schedule' }).click();

  // Reminders default ON, but are not shown as working without permission.
  await expect(page.getByRole('heading', { name: 'Your schedule has been saved' })).toBeVisible();
  const reminderSwitch = page.getByRole('switch', { name: 'Medicine reminders' });
  await expect(reminderSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.app-reminder-status')).toContainText('Waiting for permission');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Allow notifications' }).click();
  const prompt = page.getByRole('dialog', { name: '“LAI App” would like to send you notifications' });
  await prompt.getByRole('button', { name: 'Don’t allow' }).click();
  await expect(page.locator('.app-reminder-status')).toContainText('Notifications are not allowed');
  await page.getByRole('button', { name: 'Allow notifications' }).click();
  await prompt.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.locator('.app-reminder-status')).toContainText('Reminders are on');
  await reminderSwitch.click();
  await expect(reminderSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.app-reminder-status')).toContainText('Reminders are off');
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your medicine schedule/);
  await expectAccessible(page);

  // Nothing in the app or on the web page refers to a demo or a hackathon.
  await expect(page.locator('body')).not.toContainText(/demo|hackathon/i);
});

test('every answer can be changed from check answers, returning straight there', async ({ page }) => {
  await startJourney(page);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: /Metformin/ }).check();
  await continueButton(page).click();
  await addIron(page);
  await continueButton(page).click();
  const lists = page.locator('.nhsuk-summary-list');

  await page.getByRole('link', { name: 'Change the time you go to sleep' }).click();
  await expect(page.locator('#sleep-time')).toHaveValue('10');
  await expect(page.locator('#sleep-time-pm')).toBeChecked();
  await enterTime(page, 'sleep-time', '11', '15', 'pm');
  await continueButton(page).click();
  await expect(lists.first()).toContainText('11:15pm');

  await page.getByRole('link', { name: 'Change your lunch time' }).click();
  await page.locator('#lunch-skipped').uncheck();
  await enterTime(page, 'lunch-time', '12', '30', 'pm');
  await continueButton(page).click();
  await expect(lists.first()).toContainText('12:30pm');

  await page.getByRole('link', { name: 'Change the medicines you did not include' }).click();
  await page.getByRole('checkbox', { name: /Amlodipine/ }).check();
  await continueButton(page).click();
  await expect(lists.nth(1)).toContainText('Amlodipine 5mg');

  await page.getByRole('link', { name: 'Change Ferrous sulfate' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Change a medicine or supplement');
  await page.getByLabel('Amount').fill('2');
  await page.getByRole('radio', { name: 'Twice a day' }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(lists.nth(2)).toContainText('2 tablets (200mg each), Twice a day');

  await page.getByRole('link', { name: 'Add another medicine or supplement' }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('vitamin d');
  await page.getByRole('listbox').getByRole('option').first().click();
  await page.getByLabel('Amount').fill('1');
  await page.getByRole('radio', { name: 'Once a day' }).check();
  await page.getByRole('button', { name: 'Add to my list' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(lists.nth(2)).toContainText('Colecalciferol');
});

test('changing the routine creates a replacement proposal that only replaces the saved schedule once saved', async ({ page }) => {
  await saveFirstSchedule(page);
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(doseTimes(page).first()).toHaveText('7am');

  await page.getByRole('link', { name: 'Change my routine' }).click();
  await expect(page.locator('#wake-time')).toHaveValue('7');
  await expect(page.locator('#wake-time-am')).toBeChecked();
  await continueButton(page).click();
  await enterTime(page, 'breakfast-time', '9', '00', 'am');
  await continueButton(page).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(page.locator('.nhsuk-summary-list').first()).toContainText('9am');
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your updated proposed schedule/);
  await expect(page.getByText('Your saved schedule stays the same until you save this one.')).toBeVisible();
  await expect(doseTimes(page).first()).toHaveText('8am');

  // Leaving without saving keeps the original schedule.
  await page.getByRole('link', { name: 'Keep my saved schedule without changes' }).click();
  await expect(doseTimes(page).first()).toHaveText('7am');
});

test('the web page sets the app language, with right-to-left Urdu inside the app only', async ({ page }) => {
  await startJourney(page);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: /Levothyroxine/ }).check();

  // The language selector belongs to the web page, not the app.
  await expect(app(page).locator('select')).toHaveCount(0);
  const language = page.getByLabel('App language');
  await language.selectOption('pl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Które leki chcesz uwzględnić?');
  await expect(page.getByRole('checkbox', { name: /Levothyroxine/ })).toBeChecked();
  await expect(app(page)).toHaveAttribute('lang', 'pl');
  await expect(page.getByText('1 tabletka (50 micrograms)')).toBeVisible();
  await expect(page.getByText('Po angielsku, tak jak w dokumentacji')).toBeVisible();
  await expect(page.getByText('Take with or just after food')).toBeVisible();

  await language.selectOption('ur');
  await expect(app(page)).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('آپ کون سی دوائیں شامل کرنا چاہتے ہیں؟');
  await expect(page.locator('bdi[lang="en"]', { hasText: 'Levothyroxine' }).first()).toHaveAttribute('dir', 'ltr');
  // Urdu uses a bundled Naskh face, not a tall Nastaliq one.
  expect(await page.getByRole('heading', { level: 1 }).evaluate(element => getComputedStyle(element).fontFamily)).toContain('Noto Naskh Arabic');
  await expectAccessible(page);

  await page.getByRole('button', { name: 'جاری رکھیں' }).click();
  await page.getByRole('button', { name: 'میرے پاس شامل کرنے کو کچھ نہیں' }).click();
  await language.selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers');
  await expect(page.locator('.nhsuk-summary-list').first()).toContainText('7am');

  await language.selectOption('ur');
  await page.getByRole('button', { name: 'میرا شیڈول بنائیں' }).click();
  const firstTime = doseTimes(page).first();
  await expect(firstTime).toHaveAttribute('dir', 'ltr');
  await expect(firstTime).toContainText('7:00 AM');
  await expectAccessible(page);

  // The preference is remembered on the device.
  await page.reload();
  await expect(app(page)).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('نسخے');
});

test('the app is a fixed-height phone screen with bottom navigation, or full length', async ({ page }) => {
  await page.goto('/');
  const main = page.locator('.app-main');
  const nav = page.getByRole('navigation', { name: 'Main menu' });
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('radio', { name: 'Phone screen' })).toBeChecked();

  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  const screen = await page.locator('.phone-screen').boundingBox();
  expect(screen!.height).toBeLessThanOrEqual(844);
  expect(await main.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const navBox = await nav.boundingBox();
  expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(screen!.y + screen!.height);

  await page.getByRole('radio', { name: 'Full length' }).check();
  expect(await main.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(false);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Full length' })).toBeChecked();

  await nav.getByRole('link', { name: 'Messages' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Messages');
  await expect(nav.getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');
  await expectAccessible(page);
});

test('a pharmacist review leaves the saved schedule usable; returning users go straight to it; Start again clears it', async ({ page }) => {
  await saveFirstSchedule(page);
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await page.getByRole('button', { name: 'Request a pharmacist review' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pharmacist review requested');
  await expect(page.getByText('If they suggest any changes, you will get a message in the app.')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Back to my schedule' }).click();
  await expect(page.getByText(/You asked for a pharmacist review on/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request a pharmacist review' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('View your medicine schedule')).toBeVisible();
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your medicine schedule/);

  await page.getByRole('button', { name: 'Start again as a new user' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prescriptions');
  await expect(page.getByText('Organise your medicines around your day')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Organise your medicines around your day')).toBeVisible();
});

test('explains instead of producing a schedule when instructions cannot be met', async ({ page }) => {
  await startJourney(page);
  await enterTime(page, 'wake-time', '7', '00', 'am');
  await enterTime(page, 'sleep-time', '10', '30', 'pm');
  await continueButton(page).click();
  await page.locator('#breakfast-skipped').check();
  await page.locator('#lunch-skipped').check();
  await enterTime(page, 'dinner-time', '6', '30', 'pm');
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
