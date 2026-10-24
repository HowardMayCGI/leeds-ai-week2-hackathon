import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Walkthrough checks from the agreed meds-scheduler design (24 October 2026),
// using the patient records served by the local API from test_data/.

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
}

// Lilliana, Gene and Raylene have their usual day filled in; Carri does not.
const LILLIANA = 'Lilliana Kimbra Lockman';
const GENE = 'Gene Orval Witting';
const CARRI = 'Carri Dianna Cartwright';

const app = (page: Page) => page.locator('.app-root');
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue', exact: true });
const doseTimes = (page: Page) => page.locator('.app-timeline__item--doses .app-time');
const timelineAt = (page: Page, time: string) => page.locator('.nhsapp-timeline__item').filter({ has: page.locator('.app-timeline__time', { hasText: new RegExp(`^${time}`) }) });

/** Enters a 12-hour time: hour, minutes and am or pm. */
async function enterTime(page: Page, linkId: string, hour: string, minutes: string, period: 'am' | 'pm') {
  await page.locator(`#${linkId}`).fill(hour);
  await page.locator(`#${linkId}-minutes`).fill(minutes);
  await page.locator(`#${linkId}-${period}`).check();
}

/** Opens the web page, chooses the patient and waits for their record to load. */
async function openFor(page: Page, patient = LILLIANA) {
  await page.goto('/');
  await page.getByLabel('Patient').selectOption({ label: patient });
  await expect(page.getByRole('link', { name: /Schedule my medicines/ })).toBeVisible();
}

async function startJourney(page: Page, patient = LILLIANA) {
  await openFor(page, patient);
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await expect(heading(page)).toContainText('Organise your medicines around your day');
  await page.getByRole('button', { name: 'Get started' }).click();
}

async function enterRoutine(page: Page, { skipLunch = false } = {}) {
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
async function addMedicine(page: Page, search: string, option: RegExp, timing: string, frequency = 'Once a day') {
  await page.getByRole('button', { name: /^Add (another|a) medicine or supplement$/ }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill(search);
  await page.getByRole('listbox').getByRole('option', { name: option }).click();
  await page.getByLabel('Amount').fill('1');
  await page.getByRole('radio', { name: frequency, exact: true }).check();
  await page.getByRole('radio', { name: timing }).check();
  await page.getByRole('button', { name: 'Add to my list' }).click();
}

async function saveFirstSchedule(page: Page, patient = LILLIANA) {
  await startJourney(page, patient);
  await enterRoutine(page);
  for (const name of [/^Lisinopril/, /^Oxycodone/]) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'I have nothing to add' }).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await page.getByRole('button', { name: 'Save my schedule' }).click();
  await expect(page.getByRole('heading', { name: 'Your schedule has been saved' })).toBeVisible();
}

test('the web page chooses the patient whose record the app shows', async ({ page }) => {
  await page.goto('/');
  const patient = page.getByLabel('Patient');
  await expect(patient.locator('option')).toHaveCount(7);
  // Test-record markers are not shown in names.
  await expect(patient).not.toContainText('XXTESTPATIENT');
  // The selector belongs to the web page, not the app.
  await expect(app(page).locator('select')).toHaveCount(0);

  await patient.selectOption({ label: GENE });
  await expect(page.getByRole('status').filter({ hasText: 'Showing the app for' })).toHaveText(`Showing the app for ${GENE}.`);
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await enterRoutine(page);
  await expect(page.getByRole('checkbox', { name: /^Insulin lispro \(Humalog\)/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Oxycodone/ })).toHaveCount(0);

  // The app is the NHS App; the web page around it says this is a concept.
  await expect(app(page).getByRole('img', { name: 'NHS App' })).toBeVisible();
  await expect(page.locator('.showcase-notice')).toContainText('It is not a live NHS service');
  await expect(app(page)).not.toContainText(/concept|demo|hackathon/i);

  // Another patient's record replaces it, and the profile shows who is signed in.
  await patient.selectOption({ label: LILLIANA });
  await expect(page.getByRole('link', { name: /Schedule my medicines/ })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Profile' }).click();
  await expect(app(page)).toContainText(LILLIANA);
  await expect(app(page)).toContainText('999 711 1249');

  // The choice is remembered on the device.
  await page.reload();
  await expect(patient).toHaveValue('9997111249');
});

test('shows an error with a retry when the record cannot be loaded', async ({ page }) => {
  let failing = true;
  await page.route('**/api/patients/*/medications', route => (failing ? route.fulfill({ status: 503, body: '{}' }) : route.fallback()));
  await page.goto('/');
  await expect(heading(page)).toHaveText('Sorry, there is a problem with the service');
  await expectAccessible(page);
  failing = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('link', { name: /Schedule my medicines/ })).toBeVisible();
});

test('asks about the usual day when the app does not know it, checking each answer', async ({ page }) => {
  await startJourney(page, CARRI);
  await expectAccessible(page);

  // Questions come from the FHIR Questionnaire. Times are entered as hour, minutes and am or pm.
  await expect(heading(page)).toContainText('Your waking and sleeping times');
  await expect(page.locator('#wake-time')).toHaveValue('');
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
  await continueButton(page).click();

  // A skipped meal needs no time; an unanswered one does.
  await expect(heading(page)).toContainText('Your meal times');
  await enterTime(page, 'breakfast-time', '8', '', 'am');
  await page.locator('#lunch-skipped').check();
  await expect(page.locator('#lunch-time')).toHaveCount(0);
  await continueButton(page).click();
  await expect(summary).toContainText('Enter the time you usually have your evening meal');
  await enterTime(page, 'dinner-time', '6', '30', 'pm');
  await expectAccessible(page);
  await continueButton(page).click();
  await expect(heading(page)).toContainText('Which medicines do you want to include?');
});

test('completes the first-time journey with the usual day filled in, never asking about prescribed medicines', async ({ page }) => {
  await startJourney(page);
  await expectAccessible(page);

  // Lilliana's usual day is already filled in, so each routine page only needs Continue.
  await expect(heading(page)).toContainText('Your waking and sleeping times');
  await expect(page.locator('#wake-time')).toHaveValue('7');
  await expect(page.locator('#wake-time-am')).toBeChecked();
  await expect(page.locator('#sleep-time')).toHaveValue('10');
  await expect(page.locator('#sleep-time-minutes')).toHaveValue('30');
  await expect(page.locator('#sleep-time-pm')).toBeChecked();
  await continueButton(page).click();
  await expect(page.locator('#breakfast-time')).toHaveValue('8');
  await expect(page.locator('#lunch-time')).toHaveValue('1');
  await expect(page.locator('#dinner-time-minutes')).toHaveValue('30');
  await expectAccessible(page);
  await continueButton(page).click();

  // The patient's record, all unchecked, with the dose and how often for every medicine.
  const summary = page.locator('.nhsuk-error-summary');
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(14);
  for (const box of await checkboxes.all()) await expect(box).not.toBeChecked();
  const oxycodone = page.locator('.nhsuk-checkboxes__item').filter({ hasText: 'Oxycodone' });
  await expect(oxycodone).toContainText('1 capsule (10mg)');
  await expect(oxycodone).toContainText('4 times a day');
  await expect(oxycodone).toContainText('Every six hours');
  await expect(page.locator('.nhsuk-checkboxes__item').filter({ hasText: 'Alendronic acid' })).toContainText('1 tablet (10mg)');
  await expect(page.locator('.nhsuk-checkboxes__item').filter({ hasText: 'Glyceryl trinitrate' })).toContainText('Only when needed');
  await expect(page.locator('body')).not.toContainText(/qualifier value|not recorded|We will ask/);
  await continueButton(page).click();
  await expect(summary).toContainText('Select the medicines you want to include, or select none of these');
  await page.getByRole('checkbox', { name: /^Lisinopril/ }).check();
  await page.getByRole('checkbox', { name: 'None of these' }).check();
  await expect(page.getByRole('checkbox', { name: /^Lisinopril/ })).not.toBeChecked();
  await expectAccessible(page);
  for (const name of [/^Alendronic acid/, /^Lisinopril/, /^Oxycodone/, /^Simvastatin/]) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();

  // Search suggests medicines from every patient's record, by brand or generic name.
  await expect(heading(page)).toContainText('Add anything missing');
  await page.getByRole('button', { name: 'Add a medicine or supplement' }).click();
  const search = page.getByRole('combobox', { name: 'Name of medicine or supplement' });
  await search.fill('Humalog');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('listbox')).toContainText('Insulin lispro (Humalog)');
  await search.fill('naproxin');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await page.getByRole('listbox').getByRole('option', { name: /250mg/ }).click();
  // The same ingredient is already on the record.
  await expect(page.locator('#addition-same-ingredient')).toContainText('Naproxen 500mg is already on your record');
  await expect(page.getByText('Naproxen is usually taken with or just after food.')).toBeVisible();
  await page.getByLabel('Amount').fill('1');
  await page.getByRole('radio', { name: 'Twice a day' }).check();
  await page.getByRole('radio', { name: 'Before food, on an empty stomach' }).check();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Add to my list' }).click();

  // Before food goes against the guidance for naproxen, so the app checks first.
  await expect(heading(page)).toContainText('Check when you take Naproxen');
  await expect(page.locator('.nhsuk-card--warning')).toContainText('Naproxen should be taken with or just after food.');
  await continueButton(page).click();
  await expect(summary).toContainText('Select how you want it in your schedule');
  await expectAccessible(page);
  await page.getByRole('radio', { name: 'With or just after food (recommended)' }).check();
  await continueButton(page).click();
  await expect(heading(page)).toContainText('Add anything missing');
  await expect(page.locator('.nhsuk-summary-list')).toContainText('With or just after food');

  // A supplement that is not in the records can still be typed in.
  await page.getByRole('button', { name: 'Add another medicine or supplement' }).click();
  await search.fill('Turmeric');
  await expect(page.getByRole('listbox')).toContainText('No matches found');
  await page.getByRole('button', { name: 'I cannot find it in the list' }).click();
  await expect(page.locator('#addition-manual-name')).toBeFocused();
  await page.getByLabel('Strength of each tablet, capsule or dose').fill('500mg');
  await page.getByLabel('Amount').fill('1');
  await page.getByRole('radio', { name: 'Capsules' }).check();
  await page.getByRole('radio', { name: 'Once a day', exact: true }).check();
  await page.getByRole('radio', { name: 'It does not matter' }).check();
  await page.getByRole('button', { name: 'Add to my list' }).click();
  await expect(page.getByText('Not matched to our list')).toBeVisible();
  await expectAccessible(page);
  await continueButton(page).click();

  // Check answers shows every answer, with the record's dose and frequency for each medicine.
  await expect(heading(page)).toContainText('Check your answers');
  await expect(page.locator('.nhsuk-summary-list').nth(1)).toContainText('Simvastatin 20mg1 tablet (20mg), Once a day');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create my schedule' }).click();

  // Alendronic acid goes first, before breakfast, and other tablets come at least 30 minutes later.
  await expect(heading(page)).toHaveText(/Your proposed schedule/);
  await expect(page.getByText('Not saved yet')).toBeVisible();
  await expect(doseTimes(page).first()).toHaveText('7am');
  const first = timelineAt(page, '7am');
  await expect(first.locator('.app-dose')).toHaveCount(1);
  await expect(first).toContainText('Alendronic acid');
  await expect(first).toContainText('At least 30 minutes before any other medicines you swallow');
  // Naproxen is given with meals, and simvastatin in the evening.
  const naproxen = page.locator('.app-dose').filter({ hasText: 'Naproxen' });
  await expect(naproxen).toHaveCount(2);
  for (const dose of await naproxen.all()) await expect(dose).toContainText(/With your (breakfast|lunch|evening meal)/);
  await expect(page.locator('.app-dose').filter({ hasText: 'Simvastatin' })).toContainText('In the evening');
  await expect(page.locator('.app-dose').filter({ hasText: 'Oxycodone' })).toHaveCount(4);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Save my schedule' }).click();

  // Reminders default ON, but are not shown as working without permission.
  await expect(page.getByRole('heading', { name: 'Your schedule has been saved' })).toBeVisible();
  const reminderSwitch = page.getByRole('switch', { name: 'Medicine reminders' });
  await expect(reminderSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.app-reminder-status')).toContainText('Waiting for permission');
  await page.getByRole('button', { name: 'Allow notifications' }).click();
  const prompt = page.getByRole('dialog', { name: '“NHS App” would like to send you notifications' });
  await prompt.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.locator('.app-reminder-status')).toContainText('Reminders are on');
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(heading(page)).toHaveText(/Your medicine schedule/);
  await expectAccessible(page);

  // Nothing in the app or on the web page refers to a demo or a hackathon.
  await expect(page.locator('body')).not.toContainText(/demo|hackathon/i);
});

test('a patient can keep their own timing, which is flagged for a pharmacist to check', async ({ page }) => {
  await startJourney(page, GENE);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: /^Lisinopril/ }).check();
  await continueButton(page).click();
  await addMedicine(page, 'Naprosyn', /Naproxen 500mg/, 'Before food, on an empty stomach', 'Twice a day');
  await expect(heading(page)).toContainText('Check when you take Naproxen');
  await page.getByRole('radio', { name: 'Before food, as I take it now' }).check();
  await continueButton(page).click();
  const added = page.locator('.nhsuk-summary-list');
  await expect(added).toContainText('Before food, on an empty stomach');
  await expect(added).toContainText('Check with a pharmacist');

  // A medicine with no food rule is not checked.
  await addMedicine(page, 'Plavix', /Clopidogrel/, 'Before food, on an empty stomach');
  await expect(heading(page)).toContainText('Add anything missing');
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();

  const naproxen = page.locator('.app-dose').filter({ hasText: 'Naproxen' });
  await expect(naproxen).toHaveCount(2);
  for (const dose of await naproxen.all()) {
    await expect(dose).toContainText('Check with a pharmacist');
    await expect(dose).toContainText('You chose to keep taking this before food.');
    await expect(dose).not.toContainText('With your');
  }
  await expectAccessible(page);
});

test('every answer can be changed from check answers, returning straight there', async ({ page }) => {
  await startJourney(page);
  await enterRoutine(page, { skipLunch: true });
  for (const name of [/^Alendronic acid/, /^Lisinopril/]) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();
  await addMedicine(page, 'iron', /Ferrous sulfate/, 'It does not matter');
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

  // A prescribed medicine is included without asking how it is taken.
  await page.getByRole('link', { name: 'Change the medicines you did not include' }).click();
  await page.getByRole('checkbox', { name: /^Simvastatin/ }).check();
  await continueButton(page).click();
  await expect(heading(page)).toContainText('Check your answers');
  await expect(lists.nth(1)).toContainText('Simvastatin 20mg');

  await page.getByRole('link', { name: 'Change Ferrous sulfate' }).click();
  await expect(heading(page)).toContainText('Change a medicine or supplement');
  await page.getByLabel('Amount').fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(heading(page)).toContainText('Check your answers');
  await expect(page.getByText('2 tablets (325mg each)')).toBeVisible();

  await page.getByRole('link', { name: 'Add another medicine or supplement' }).click();
  await page.getByRole('combobox', { name: 'Name of medicine or supplement' }).fill('Ventolin');
  await page.getByRole('listbox').getByRole('option').first().click();
  await page.getByLabel('Amount').fill('2');
  await page.getByRole('radio', { name: 'Only when needed' }).check();
  await page.getByRole('radio', { name: 'It does not matter' }).check();
  await page.getByRole('button', { name: 'Add to my list' }).click();
  await expect(heading(page)).toContainText('Check your answers');
  await expect(page.locator('main')).toContainText('Salbutamol');
});

test('changing the routine creates a replacement proposal that only replaces the saved schedule once saved', async ({ page }) => {
  await saveFirstSchedule(page);
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(doseTimes(page).first()).toHaveText('7am');

  await page.getByRole('link', { name: 'Change my routine' }).click();
  await expect(page.locator('#wake-time')).toHaveValue('7');
  await expect(page.locator('#wake-time-am')).toBeChecked();
  await page.locator('#wake-time').fill('6');
  await continueButton(page).click();
  await continueButton(page).click();
  await expect(heading(page)).toContainText('Check your answers');
  await expect(page.locator('.nhsuk-summary-list').first()).toContainText('6am');
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(heading(page)).toHaveText(/Your updated proposed schedule/);
  await expect(page.getByText('Your saved schedule stays the same until you save this one.')).toBeVisible();
  await expect(doseTimes(page).first()).toHaveText('6am');

  // Leaving without saving keeps the original schedule.
  await page.getByRole('link', { name: 'Keep my saved schedule without changes' }).click();
  await expect(doseTimes(page).first()).toHaveText('7am');
});

test('the web page sets the app language, with right-to-left Urdu inside the app only', async ({ page }) => {
  await startJourney(page);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: /^Oxycodone/ }).check();

  // The language selector belongs to the web page, not the app.
  await expect(app(page).locator('select')).toHaveCount(0);
  const language = page.getByLabel('App language');
  await language.selectOption('pl');
  await expect(heading(page)).toContainText('Które leki chcesz uwzględnić?');
  await expect(page.getByRole('checkbox', { name: /^Oxycodone/ })).toBeChecked();
  await expect(app(page)).toHaveAttribute('lang', 'pl');
  await expect(page.getByText('1 kapsułka (10mg)')).toBeVisible();
  await expect(page.getByText('Po angielsku, tak jak w dokumentacji').first()).toBeVisible();
  await expect(page.getByText('Every six hours')).toBeVisible();

  await language.selectOption('ur');
  await expect(app(page)).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(heading(page)).toContainText('آپ کون سی دوائیں شامل کرنا چاہتے ہیں؟');
  await expect(page.locator('bdi[lang="en"]', { hasText: 'Oxycodone' }).first()).toHaveAttribute('dir', 'ltr');
  // Urdu uses a bundled Naskh face, not a tall Nastaliq one.
  expect(await heading(page).evaluate(element => getComputedStyle(element).fontFamily)).toContain('Noto Naskh Arabic');
  await expectAccessible(page);

  await page.getByRole('button', { name: 'جاری رکھیں' }).click();
  await page.getByRole('button', { name: 'میرے پاس شامل کرنے کو کچھ نہیں' }).click();
  await language.selectOption('en');
  await expect(heading(page)).toContainText('Check your answers');
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
  await expect(heading(page)).toHaveText('نسخے');
});

test('the app is a fixed-height phone screen with bottom navigation, or full length', async ({ page }) => {
  await openFor(page);
  const main = page.locator('.app-main');
  const nav = page.getByRole('navigation', { name: 'Main menu' });
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('radio', { name: 'Phone screen' })).toBeChecked();

  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  const screen = await page.locator('.phone-screen').boundingBox();
  // The screen keeps an iPhone's proportions (393 by 852 points).
  expect(screen!.height / screen!.width).toBeCloseTo(852 / 393, 1);
  expect(await main.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const navBox = await nav.boundingBox();
  expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(screen!.y + screen!.height);

  await page.getByRole('radio', { name: 'Full length' }).check();
  expect(await main.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(false);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Full length' })).toBeChecked();

  await nav.getByRole('link', { name: 'Messages' }).click();
  await expect(heading(page)).toHaveText('Messages');
  await expect(nav.getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');
  await expectAccessible(page);
});

test('a pharmacist review leaves the saved schedule usable; each patient has their own; Start again clears it', async ({ page }) => {
  await saveFirstSchedule(page);
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await page.getByRole('button', { name: 'Request a pharmacist review' }).click();
  await expect(heading(page)).toHaveText('Pharmacist review requested');
  await expect(page.getByText('If they suggest any changes, you will get a message in the app.')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Back to my schedule' }).click();
  await expect(page.getByText(/You asked for a pharmacist review on/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request a pharmacist review' })).toHaveCount(0);

  // Returning users go straight to their schedule.
  await page.reload();
  await expect(page.getByText('View your medicine schedule')).toBeVisible();
  await page.getByRole('link', { name: /Schedule my medicines/ }).click();
  await expect(heading(page)).toHaveText(/Your medicine schedule/);

  // A saved schedule belongs to one patient.
  const patient = page.getByLabel('Patient');
  await patient.selectOption({ label: GENE });
  await expect(page.getByText('Organise your medicines around your day')).toBeVisible();
  await patient.selectOption({ label: LILLIANA });
  await expect(page.getByText('View your medicine schedule')).toBeVisible();

  await page.getByRole('button', { name: 'Start again as a new user' }).click();
  await expect(heading(page)).toHaveText('Prescriptions');
  await expect(page.getByText('Organise your medicines around your day')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Organise your medicines around your day')).toBeVisible();
});

test('explains instead of producing a schedule when instructions cannot be met', async ({ page }) => {
  await startJourney(page, GENE);
  await enterTime(page, 'wake-time', '7', '00', 'am');
  await enterTime(page, 'sleep-time', '10', '30', 'pm');
  await continueButton(page).click();
  await page.locator('#breakfast-skipped').check();
  await page.locator('#lunch-skipped').check();
  await enterTime(page, 'dinner-time', '6', '30', 'pm');
  await continueButton(page).click();
  await page.getByRole('checkbox', { name: 'None of these' }).check();
  await continueButton(page).click();
  await addMedicine(page, 'naproxen', /Naproxen 250mg/, 'With or just after food', 'Twice a day');
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(heading(page)).toContainText('We cannot create a schedule with these answers');
  await expect(page.getByText(/Naproxen needs to be taken with food 2 times a day/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save my schedule' })).toHaveCount(0);
  await expectAccessible(page);
});
