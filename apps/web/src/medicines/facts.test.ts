import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProposal, toMedicineOption, toRecordMedicine, type PatientAddition, type Proposal, type SourceMedication } from '@hackathon/medicines';
import { gapMet, scheduleFacts, type Interaction } from './facts';

const routine = { wake: '07:00', sleep: '22:30', meals: { breakfast: '08:00', lunch: null, dinner: '18:30' } };
const source = (id: string, name: string, frequency: number): SourceMedication => ({
  id, code: id, name, asNeeded: false, instructions: [], dose: { value: 1, unit: 'tablet' }, frequency: { frequency, period: 1, periodUnit: 'd' },
});
const record = [
  source('levo', 'Levothyroxine sodium 75microgram tablets', 1),
  source('naproxen', 'Naproxen 500mg tablets', 2),
  source('lisinopril', 'lisinopril 10 MG Oral Tablet', 1),
].map(toRecordMedicine);
const iron: PatientAddition = {
  id: 'iron', medicine: toMedicineOption({ code: '39107411000001105', name: 'Ferrous sulfate 325mg modified-release tablets' }),
  name: 'Ferrous sulfate', strength: '325mg', dose: { quantity: 1, unit: 'tablet' }, frequency: 'once-daily', timing: 'any',
};

function proposal(): Extract<Proposal, { status: 'ok' }> {
  const result = createProposal({ routine, record, selectedRecordIds: ['levo', 'naproxen', 'lisinopril'], additions: [iron] });
  assert.equal(result.status, 'ok');
  return result as Extract<Proposal, { status: 'ok' }>;
}

test('schedule facts give each dose its time, notes and the reasons from the rules', () => {
  const facts = scheduleFacts(proposal(), 'en');
  assert.deepEqual(facts.routine.map(fact => fact.text), [
    'You usually wake up at 7am.',
    'You usually have breakfast at 8am.',
    'You do not usually eat lunch.',
    'You usually have your evening meal at 6:30pm.',
    'You usually go to sleep at 10:30pm.',
  ]);
  const levo = facts.doses.find(dose => dose.key === 'record:levo')!;
  assert.match(levo.facts[0].text, /^Levothyroxine sodium 75 micrograms: 1 tablet at 7am\.$/);
  assert.ok(levo.facts.some(fact => fact.id.includes(':reason') && /empty stomach/.test(fact.text)));
  // Iron is kept apart from levothyroxine, and its facts say why.
  const ferrous = facts.doses.find(dose => dose.key === 'patient:iron')!;
  assert.ok(ferrous.facts.some(fact => /at least 4 hours apart from Levothyroxine sodium 75 micrograms/.test(fact.text)));
  assert.ok(ferrous.facts.some(fact => fact.id.includes(':reason') && /absorbed properly/.test(fact.text)));
  // Naproxen is twice a day, with food.
  const naproxen = facts.doses.filter(dose => dose.key === 'record:naproxen');
  assert.equal(naproxen.length, 2);
  assert.ok(naproxen[0].facts.some(fact => /twice a day/.test(fact.text)));
  assert.ok(naproxen[0].facts.some(fact => /upset your stomach/.test(fact.text)));
  // Lisinopril has no instructions, so its time only fits the patient's day.
  const lisinopril = facts.doses.find(dose => dose.key === 'record:lisinopril')!;
  assert.ok(lisinopril.facts.some(fact => fact.id.endsWith(':fits-day')));
});

test('facts are short, use ids the API accepts and write times as the app shows them', () => {
  const facts = scheduleFacts(proposal(), 'pl', {
    reminders: { enabled: true, permission: 'granted' }, savedAt: '2026-10-25T08:00:00Z',
  });
  const every = [...facts.all, ...facts.doses.flatMap(dose => dose.facts)];
  for (const fact of every) {
    assert.match(fact.id, /^[A-Za-z0-9:@._-]{1,80}$/);
    assert.ok(fact.text.length <= 400, fact.id);
  }
  assert.equal(facts.routine[0].text, 'You usually wake up at 7:00 AM.');
  // Each dose fact for questions starts with the medicine's name, and its source is the dose.
  const dose = facts.all.find(fact => fact.id === 'dose:1')!;
  assert.match(dose.text, /^Levothyroxine/);
  assert.deepEqual(facts.sources['dose:1'], { kind: 'dose', key: 'record:levo', time: '07:00' });
  assert.ok(facts.all.some(fact => fact.id === 'reminders' && /switched on/.test(fact.text)));
  assert.ok(facts.all.some(fact => fact.id === 'review' && /optional/.test(fact.text)));
});

test('interactions become facts, and a gap is only met when every dose pair is far enough apart', () => {
  const plan = proposal();
  const keepApart: Interaction = {
    id: 'x', ruleId: 'levothyroxine--ferrous-sulfate', severity: 'moderate', action: 'separate_doses', minimumGapMinutes: 240,
    effect: 'Iron reduces absorption of levothyroxine.', patientGuidance: 'Keep these doses at least 4 hours apart.',
    medicineIds: ['record:levo', 'patient:iron'], sourceIds: [],
  };
  const review: Interaction = { ...keepApart, id: 'y', action: 'prescriber_review', minimumGapMinutes: undefined, medicineIds: ['record:naproxen', 'record:lisinopril'], patientGuidance: 'Ask your GP.' };
  const facts = scheduleFacts(plan, 'en', { interactions: [keepApart, review] });
  assert.match(facts.all.find(fact => fact.id === 'interaction:1')!.text, /^Levothyroxine sodium 75 micrograms and Ferrous sulfate 325mg can interact\. Iron reduces absorption of levothyroxine\. Keep these doses at least 4 hours apart\. Your schedule keeps them at least 4 hours apart\.$/);
  assert.match(facts.all.find(fact => fact.id === 'interaction:2')!.text, /^Naproxen 500mg and Lisinopril 10mg can interact\. Iron reduces absorption of levothyroxine\. Ask your GP\.$/);
  assert.equal(gapMet(keepApart, plan), true);
  assert.equal(gapMet({ ...keepApart, minimumGapMinutes: 24 * 60 }, plan), false);
  assert.equal(gapMet(review, plan), false);
});
