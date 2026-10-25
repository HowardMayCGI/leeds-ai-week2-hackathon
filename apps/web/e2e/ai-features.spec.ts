import { expect, test, type Page } from '@playwright/test';
import {
  addMedicine, app, CARRI, continueButton, enterRoutine, expectAccessible, heading, LILLIANA, saveFirstSchedule, startJourney,
} from './journey';

// AI help in the app, run against the local API in test mode: answers come
// from built-in rules, not a model, and go through the same checks as live
// answers. Interaction warnings use the API's interaction rules.

const GENEVIVE = 'Genevive Despina Ernser';
// A 1 by 1 pixel PNG. In test mode every photo reads as the same pharmacy label.
const PHOTO = { name: 'label.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') };

/** From the start of the journey to the proposed schedule, with the usual day entered and these medicines from the record. */
async function proposeSchedule(page: Page, medicines: RegExp[], patient = LILLIANA) {
  await startJourney(page, patient);
  await enterRoutine(page);
  for (const name of medicines) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'I have nothing to add' }).click();
  const checked = page.waitForResponse('**/api/interactions');
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(heading(page)).toHaveText(/Your proposed schedule/);
  await checked;
}

test('fills in the usual day from the patient’s own words, for them to check', async ({ page }) => {
  await startJourney(page, CARRI);
  const reader = page.getByTestId('day-reader');
  const fillIn = reader.getByRole('button', { name: 'Fill in my times' });
  await fillIn.click();
  await expect(page.locator('#day-description-error')).toContainText('Describe your usual day');
  await expect(page.locator('#day-description')).toBeFocused();

  await page.getByLabel('Your usual day').fill('I get up at half six, have breakfast at 7.15, I skip lunch, tea at 6 and bed about 11');
  await fillIn.click();
  const result = page.locator('#day-result');
  await expect(result).toBeFocused();
  await expect(result).toContainText('We have filled in these times. Check them before you continue.');
  await expect(result.getByRole('listitem')).toHaveText([
    'Wake up: 6:30am', 'Breakfast: 7:15am', 'Lunch: you do not usually eat it', 'Evening meal: 6pm', 'Go to sleep: 11pm',
  ]);
  await expect(page.locator('#wake-time')).toHaveValue('6');
  await expect(page.locator('#wake-time-minutes')).toHaveValue('30');
  await expect(page.locator('#wake-time-am')).toBeChecked();
  await expect(page.locator('#sleep-time')).toHaveValue('11');
  await expect(page.locator('#sleep-time-pm')).toBeChecked();
  await expectAccessible(page);

  // A second description only changes the times it mentions.
  await page.getByLabel('Your usual day').fill('I go to bed at 10pm');
  await fillIn.click();
  await expect(result).toContainText('Go to sleep: 10pm');
  await expect(result).toContainText('Enter these yourself:');
  await expect(page.locator('#sleep-time')).toHaveValue('10');
  await expect(page.locator('#wake-time')).toHaveValue('6');
  await expect(page.locator('#wake-time-minutes')).toHaveValue('30');

  // The patient checks each page as usual.
  await continueButton(page).click();
  await expect(heading(page)).toContainText('Your meal times');
  await expect(page.locator('#breakfast-time')).toHaveValue('7');
  await expect(page.locator('#breakfast-time-minutes')).toHaveValue('15');
  await expect(page.locator('#breakfast-time-am')).toBeChecked();
  await expect(page.locator('#lunch-skipped')).toBeChecked();
  await expect(page.locator('#dinner-time')).toHaveValue('6');
  await expect(page.locator('#dinner-time-pm')).toBeChecked();
  await continueButton(page).click();
  await expect(heading(page)).toContainText('Which medicines do you want to include?');
});

test('fills in a medicine from a photo or a description, for the patient to check before adding it', async ({ page }) => {
  await startJourney(page);
  await continueButton(page).click();
  await continueButton(page).click();
  await page.getByRole('checkbox', { name: /^Lisinopril/ }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Add a medicine or supplement' }).click();
  const reader = page.getByTestId('medicine-reader');
  const fillIn = reader.getByRole('button', { name: 'Fill in the form' });
  await fillIn.click();
  await expect(page.locator('#reader-photo-error')).toContainText('Add a photo or describe the medicine');
  await expectAccessible(page);

  // A photo of a pharmacy label: the medicine is found in the list, and anything missing is named.
  await page.getByLabel('Take or choose a photo').setInputFiles(PHOTO);
  await expect(reader.getByText('Photo added')).toBeVisible();
  await expect(page.locator('#reader-photo-error')).toHaveCount(0);
  await fillIn.click();
  const result = page.locator('#reader-result');
  await expect(result).toBeFocused();
  await expect(result).toContainText('We have filled in the form. Check every answer before you add it.');
  await expect(result).toContainText('when you take it');
  await expect(page.locator('#addition-selected')).toContainText('Ferrous sulfate');
  await expect(page.locator('#addition-same-ingredient')).toContainText('Ferrous sulfate 325mg is already on your record');
  await expect(page.getByLabel('Amount')).toHaveValue('1');
  await expect(page.getByRole('radio', { name: 'Once a day', exact: true })).toBeChecked();
  await expect(page.locator('#addition-instructions')).toHaveValue('Do not take indigestion remedies at the same time of day as this medicine');
  await expectAccessible(page);

  // A description replaces everything the photo filled in.
  await reader.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.locator('#reader-photo')).toBeFocused();
  await page.getByLabel('Describe the medicine (optional)').fill('Vitamin D 1000 units, 1 capsule a day with breakfast');
  await fillIn.click();
  await expect(result).toContainText('We could not find this in our medicines list, so we have entered the name as written.');
  await expect(result).not.toContainText('We could not find these');
  await expect(page.locator('#addition-manual-name')).toHaveValue('Vitamin D');
  await expect(page.locator('#addition-strength')).toHaveValue('1000 units');
  await expect(page.getByRole('radio', { name: 'Capsules' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'With or just after food' })).toBeChecked();
  await expect(page.locator('#addition-instructions')).toHaveValue('');
  await page.getByRole('button', { name: 'Add to my list' }).click();
  await expect(heading(page)).toContainText('Add anything missing');
  await expect(page.locator('main')).toContainText('Vitamin D');
  await expect(page.locator('.nhsuk-summary-list')).toContainText('1 capsule (1000 units)');
  await expect(page.locator('.nhsuk-summary-list')).toContainText('With or just after food');
});

test('warns about medicines that need checking together, and says nothing when there is no match', async ({ page }) => {
  await proposeSchedule(page, [/^Clopidogrel/, /^Naproxen/]);
  const warnings = page.getByTestId('interaction-warnings');
  await expect(warnings.getByRole('heading', { name: 'Check these medicines with a GP or pharmacist' })).toBeVisible();
  await expect(warnings.getByRole('heading', { name: 'Clopidogrel 75mg and Naproxen 500mg' })).toBeVisible();
  await expect(warnings).toContainText('Taking them at different times does not remove the risk.');
  await expect(warnings).toContainText('Do not stop taking a prescribed medicine unless a doctor or pharmacist tells you to.');
  await warnings.getByText('Why this matters').click();
  await expect(warnings).toContainText('Increased risk of gastrointestinal bleeding.');
  await expectAccessible(page);

  // The warning stays with the saved schedule.
  await page.getByRole('button', { name: 'Save my schedule' }).click();
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(page.getByTestId('interaction-warnings')).toContainText('Clopidogrel 75mg and Naproxen 500mg');
  await expectAccessible(page);

  // No match is not shown as safe: nothing is said at all.
  await page.getByRole('button', { name: 'Start again as a new user' }).click();
  await proposeSchedule(page, [/^Lisinopril/, /^Oxycodone/]);
  await expect(page.getByTestId('interaction-warnings')).toHaveCount(0);
  await expect(app(page)).not.toContainText(/safe to take|no interactions/i);
});

test('keeps doses apart when the interaction rules say so, and asks the patient to check when it cannot', async ({ page }) => {
  // Levothyroxine and iron every day: the schedule keeps them 4 hours apart.
  await startJourney(page);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: 'None of these' }).check();
  await continueButton(page).click();
  await addMedicine(page, 'levothyroxine', /Levothyroxine/, 'Before food, on an empty stomach');
  await addMedicine(page, 'iron', /Ferrous sulfate/, 'It does not matter');
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  const apart = page.locator('.nhsuk-inset-text').filter({ hasText: 'at least 4 hours apart, as advised' });
  await expect(apart).toContainText('Levothyroxine');
  await expect(apart).toContainText('Ferrous sulfate');
  await expect(page.getByTestId('interaction-warnings')).toHaveCount(0);
  await expectAccessible(page);

  // Genevive's levothyroxine is not taken every day, so the schedule cannot keep the doses apart.
  await startJourney(page, GENEVIVE);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: /^Levothyroxine/ }).check();
  await continueButton(page).click();
  await addMedicine(page, 'iron', /Ferrous sulfate/, 'It does not matter');
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(page.getByTestId('interaction-warnings')).toContainText('These need to be taken at least 4 hours apart.');
  await expect(apart).toHaveCount(0);
});

test('the interaction check can be tried again when it fails', async ({ page }) => {
  let failing = true;
  await page.route('**/api/interactions', route => (failing ? route.fulfill({ status: 503, body: '{}' }) : route.fallback()));
  await startJourney(page);
  await enterRoutine(page);
  for (const name of [/^Clopidogrel/, /^Naproxen/]) await page.getByRole('checkbox', { name }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'I have nothing to add' }).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(page.getByText('We could not check your medicines against each other just now.')).toBeVisible();
  // The schedule itself is still shown and can be saved.
  await expect(page.getByRole('button', { name: 'Save my schedule' })).toBeVisible();
  failing = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('interaction-warnings')).toContainText('Clopidogrel 75mg and Naproxen 500mg');
});

test('explains why each medicine is at its time, only from the instructions the app followed', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ai/explain') requests++; });
  await proposeSchedule(page, [/^Lisinopril/, /^Naproxen/]);
  const panel = page.getByTestId('explain-panel');
  await expect(page.locator('.app-explanation')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Explain my schedule' }).click();
  await expect(panel).toBeFocused();
  await expect(panel).toContainText('Written by AI');
  await expect(panel).toContainText('They are not medical advice.');
  const doses = await page.locator('.app-dose').count();
  await expect(page.locator('.app-explanation')).toHaveCount(doses);
  const naproxen = page.locator('.app-dose').filter({ hasText: 'Naproxen' });
  await expect(naproxen.first()).toBeVisible();
  for (const dose of await naproxen.all()) await expect(dose.locator('.app-explanation')).toContainText('less likely to upset your stomach');
  await expect(page.locator('.app-dose').filter({ hasText: 'Lisinopril' }).locator('.app-explanation')).toContainText('no food or time-of-day instructions');
  await expectAccessible(page);

  // Hiding and showing again does not ask again.
  await panel.getByRole('button', { name: 'Hide explanations' }).click();
  await expect(page.locator('.app-explanation')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Explain my schedule' }).click();
  await expect(page.locator('.app-explanation')).toHaveCount(doses);
  expect(requests).toBe(1);

  // The explanations stay with the schedule once it is saved.
  await page.getByRole('button', { name: 'Save my schedule' }).click();
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(page.locator('.app-explanation')).toHaveCount(doses);

  // In another language they are asked for again; answers only in English say so.
  await page.getByLabel('App language').selectOption('pl');
  await expect(page.locator('.app-explanation')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Wyjaśnij mój plan' }).click();
  await expect(panel).toContainText('Dostępne tylko po angielsku');
  await expect(page.locator('.app-explanation__text').first()).toHaveAttribute('lang', 'en');
  expect(requests).toBe(2);
  await expectAccessible(page);
});

test('answers questions about the saved schedule, with fixed wording for emergencies and medical advice', async ({ page }) => {
  await saveFirstSchedule(page);
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await page.getByRole('link', { name: 'Ask a question' }).click();
  await expect(heading(page)).toHaveText(/Ask about your schedule/);
  await expect(page.getByText('We cannot give medical advice here.')).toBeVisible();
  await expectAccessible(page);

  const ask = page.getByRole('button', { name: 'Ask', exact: true });
  await ask.click();
  await expect(page.locator('.nhsuk-error-summary')).toContainText('Enter your question');

  // A suggested question, answered from the schedule with its sources.
  await page.getByRole('button', { name: 'When do I take Lisinopril?' }).click();
  const answers = page.locator('.app-conversation__answer');
  await expect(answers).toHaveCount(1);
  await expect(answers.last()).toBeFocused();
  await expect(answers.last()).toContainText('Written by AI');
  await expect(answers.last()).toContainText('Lisinopril');
  await expect(answers.last()).toContainText('Based on');

  const question = page.getByLabel('Your question');
  await question.fill('I think I have taken too many tablets');
  await ask.click();
  await expect(answers.last()).toContainText('Get help now');
  await expect(answers.last()).toContainText('call 999 or go to A&E now');

  await question.fill('Can I drink alcohol with my medicines?');
  await ask.click();
  await expect(answers.last()).toContainText('We cannot answer this here, because it needs medical advice.');

  await question.fill('What will the weather be like tomorrow?');
  await ask.click();
  await expect(answers.last()).toContainText('We can only answer questions about the times and instructions in your saved schedule.');
  await expect(answers).toHaveCount(4);
  await expectAccessible(page);

  // The questions stay for the visit.
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(heading(page)).toHaveText(/Your medicine schedule/);
  await page.getByRole('link', { name: 'Ask a question' }).click();
  await expect(answers).toHaveCount(4);
  await expect(app(page)).not.toContainText(/demo|hackathon/i);
});

test('the app works as normal when AI help is off', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { mode: 'off' } }));
  await startJourney(page, CARRI);
  await expect(page.locator('.showcase-status')).toHaveText('AI help is off. Everything else in the app works as normal.');
  await expect(page.getByTestId('day-reader')).toHaveCount(0);
  await enterRoutine(page);
  await page.getByRole('checkbox', { name: /^Lisinopril/ }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Add a medicine or supplement' }).click();
  await expect(heading(page)).toContainText('Add a medicine or supplement');
  await expect(page.getByTestId('medicine-reader')).toHaveCount(0);
  await page.getByRole('link', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'I have nothing to add' }).click();
  await page.getByRole('button', { name: 'Create my schedule' }).click();
  await expect(heading(page)).toHaveText(/Your proposed schedule/);
  await expect(page.getByTestId('explain-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save my schedule' }).click();
  await page.getByRole('button', { name: 'View my schedule' }).click();
  await expect(heading(page)).toHaveText(/Your medicine schedule/);
  await expect(page.getByRole('link', { name: 'Ask a question' })).toHaveCount(0);
});

test('falls back to the form when AI help cannot answer', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { mode: 'live', model: 'Claude Haiku 5.5 on Amazon Bedrock' } }));
  await page.route('**/api/ai/medicine', route => route.fulfill({ status: 503, body: '{}' }));
  await startJourney(page);
  await expect(page.locator('.showcase-status')).toContainText('AI help is on. Claude Haiku 5.5 on Amazon Bedrock reads medicine labels');
  await continueButton(page).click();
  await continueButton(page).click();
  await page.getByRole('checkbox', { name: /^Lisinopril/ }).check();
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Add a medicine or supplement' }).click();
  await page.getByLabel('Describe the medicine (optional)').fill('Vitamin D 1000 units once a day');
  await page.getByTestId('medicine-reader').getByRole('button', { name: 'Fill in the form' }).click();
  await expect(page.locator('#reader-result')).toHaveText('This is not available right now. Fill in the form yourself.');
  await expect(page.locator('#reader-result')).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Name of medicine or supplement' })).toHaveValue('');
  await expectAccessible(page);
});
