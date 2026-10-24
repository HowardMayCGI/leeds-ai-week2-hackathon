import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  answersFromResponse, buildResponse, findItem, flatten, hintFor, initialAnswers, isEnabled, isInstructions, itemText,
  localise, ROUTINE_QUESTIONNAIRE, routinePages, setAnswer, toRoutine, validatePage, type Answers,
} from './questionnaire';

const complete: Answers = {
  ...initialAnswers(), 'wake-time': '07:00', 'sleep-time': '22:30', 'breakfast-time': '08:00', 'lunch-time': '13:00', 'dinner-time': '18:30',
};

test('is a versioned FHIR R4 Questionnaire with two routine groups and unique link ids', () => {
  assert.equal(ROUTINE_QUESTIONNAIRE.resourceType, 'Questionnaire');
  assert.match(ROUTINE_QUESTIONNAIRE.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(routinePages().map(page => page.linkId), ['waking-sleeping', 'meal-times']);
  const ids = flatten().map(item => item.linkId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(findItem('wake-time')?.type, 'time');
  assert.equal(findItem('breakfast-skipped')?.type, 'boolean');
  assert.ok(isInstructions(findItem('waking-sleeping-intro')!));
  assert.equal(hintFor(findItem('wake-time')!)?.linkId, 'wake-time-hint');
});

test('every question, hint and option has Polish and Urdu translations, with an explicit English fallback', () => {
  for (const item of flatten()) {
    for (const lang of ['pl', 'ur']) {
      const text = itemText(item, lang);
      assert.equal(text.lang, lang, `${item.linkId} is missing ${lang}`);
      assert.notEqual(text.text, item.text);
    }
  }
  assert.equal(localise(ROUTINE_QUESTIONNAIRE.title, ROUTINE_QUESTIONNAIRE._title, 'ur').text, 'آپ کا روزمرہ کا معمول');
  assert.deepEqual(itemText(findItem('wake-time')!, 'cy'), { text: 'What time do you usually wake up?', lang: 'en' });
});

test('a skipped meal needs no time and drops any stale time answer', () => {
  const meals = routinePages()[1];
  let answers = setAnswer(complete, 'lunch-skipped', true);
  assert.equal(answers['lunch-time'], undefined);
  assert.equal(isEnabled(findItem('lunch-time')!, answers), false);
  answers = setAnswer(answers, 'lunch-time', undefined);
  assert.deepEqual(validatePage(meals, answers), []);
  assert.equal(toRoutine(answers)?.meals.lunch, null);
});

test('a missing time is different from a skipped meal and is reported against its field', () => {
  const meals = routinePages()[1];
  const answers = { ...complete, 'dinner-time': undefined };
  assert.deepEqual(validatePage(meals, answers), [{ linkId: 'dinner-time', code: 'required' }]);
  assert.equal(toRoutine(answers), null);
  assert.deepEqual(validatePage(routinePages()[0], { ...initialAnswers() }), [
    { linkId: 'wake-time', code: 'required' }, { linkId: 'sleep-time', code: 'required' },
  ]);
  assert.deepEqual(validatePage(routinePages()[0], { 'wake-time': '7am', 'sleep-time': '22:00' }), [{ linkId: 'wake-time', code: 'invalid-time' }]);
});

test('cross-field checks keep meals within the waking day and allow sleeping after midnight', () => {
  const [sleeping, meals] = routinePages();
  assert.deepEqual(validatePage(sleeping, { ...complete, 'sleep-time': '07:00' }), [{ linkId: 'sleep-time', code: 'sleep-same-as-wake' }]);
  assert.deepEqual(validatePage(sleeping, { ...complete, 'sleep-time': '00:30' }), []);
  assert.deepEqual(validatePage(meals, { ...complete, 'breakfast-time': '06:00' }), [{ linkId: 'breakfast-time', code: 'meal-outside-waking-day', meal: 'breakfast' }]);
  assert.deepEqual(validatePage(meals, { ...complete, 'lunch-time': '19:00' }), [{ linkId: 'dinner-time', code: 'meals-out-of-order', meal: 'dinner', previous: 'lunch' }]);
});

test('builds a QuestionnaireResponse pinned to the version, with typed answers that survive a round trip', () => {
  const answers = setAnswer(complete, 'breakfast-skipped', true);
  const response = buildResponse(answers, '2026-10-24T10:00:00Z', 'ur');
  assert.equal(response.questionnaire, `${ROUTINE_QUESTIONNAIRE.url}|${ROUTINE_QUESTIONNAIRE.version}`);
  const meals = response.item.find(item => item.linkId === 'meal-times')!;
  const breakfast = meals.item!.find(item => item.linkId === 'breakfast')!;
  assert.deepEqual(breakfast.item, [{ linkId: 'breakfast-skipped', text: 'I do not usually eat this meal', answer: [{ valueBoolean: true }] }]);
  const wake = response.item[0].item!.find(item => item.linkId === 'wake-time')!;
  assert.deepEqual(wake.answer, [{ valueTime: '07:00:00' }]);
  assert.deepEqual(answersFromResponse(response), answers);
  // Display language does not change answer identity or meaning.
  const english = buildResponse(answers, '2026-10-24T10:00:00Z', 'en');
  assert.deepEqual(english.item, response.item);
});
