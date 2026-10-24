import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAssignment } from './checker';
import { buildConstraints, classify, type PatientAddition } from './items';
import { createProposal, dayTimeline, groupByTime, type Proposal } from './proposal';
import { PATIENT_RECORD } from './record';
import { toDay, type Routine } from './routine';
import { formatClockTime } from './time';

const routine: Routine = { wake: '07:00', sleep: '22:30', meals: { breakfast: '08:00', lunch: '13:00', dinner: '18:30' } };
const allRecord = PATIENT_RECORD.map(medicine => medicine.id);
const iron: PatientAddition = { id: 'iron', productId: 'ferrous-sulfate-200mg-tablet', name: 'Ferrous sulfate', strength: '', dose: { quantity: 1, unit: 'tablet' }, frequency: 'once-daily' };

function times(proposal: Proposal) {
  assert.equal(proposal.status, 'ok', JSON.stringify(proposal.status === 'blocked' && proposal.problems));
  return proposal.status === 'ok' ? proposal.doses.map(dose => `${dose.time} ${dose.key}`) : [];
}

test('creates the expected schedule around the usual day', () => {
  const proposal = createProposal({ routine, record: PATIENT_RECORD, selectedRecordIds: allRecord, additions: [] });
  assert.deepEqual(times(proposal), [
    '07:00 record:rec-levothyroxine',
    '07:00 record:rec-amlodipine',
    '08:00 record:rec-metformin',
    '18:30 record:rec-metformin',
    '18:30 record:rec-atorvastatin',
  ]);
  assert.deepEqual(proposal.whenNeeded, ['record:rec-paracetamol']);
  assert.ok(proposal.status === 'ok' && proposal.checks.every(check => check.pass));
  const levothyroxine = proposal.status === 'ok' ? proposal.doses[0] : undefined;
  assert.deepEqual(levothyroxine?.notes, [{ code: 'before-meal', meal: 'breakfast', minutes: 60 }]);
});

test('only medicines the patient checked are included', () => {
  const proposal = createProposal({ routine, record: PATIENT_RECORD, selectedRecordIds: ['rec-amlodipine'], additions: [] });
  assert.deepEqual(times(proposal), ['07:00 record:rec-amlodipine']);
  assert.deepEqual(proposal.items.map(item => item.key), ['record:rec-amlodipine']);
});

test('fits around a skipped breakfast without dropping a with-food rule', () => {
  const proposal = createProposal({ routine: { ...routine, meals: { ...routine.meals, breakfast: null } }, record: PATIENT_RECORD, selectedRecordIds: allRecord, additions: [] });
  const scheduled = times(proposal);
  assert.ok(scheduled.includes('13:00 record:rec-metformin'));
  assert.ok(scheduled.includes('18:30 record:rec-metformin'));
});

test('explains instead of relaxing a rule when no valid schedule exists', () => {
  const proposal = createProposal({
    routine: { ...routine, meals: { breakfast: null, lunch: null, dinner: '18:30' } }, record: PATIENT_RECORD, selectedRecordIds: allRecord, additions: [],
  });
  assert.equal(proposal.status, 'blocked');
  assert.deepEqual(proposal.status === 'blocked' && proposal.problems, [{ code: 'not-enough-meals', key: 'record:rec-metformin', doses: 2, meals: 1 }]);
});

test('keeps an added iron supplement apart from levothyroxine', () => {
  const proposal = createProposal({ routine, record: PATIENT_RECORD, selectedRecordIds: allRecord, additions: [iron] });
  assert.equal(proposal.status, 'ok');
  if (proposal.status !== 'ok') return;
  const ironDose = proposal.doses.find(dose => dose.key === 'patient:iron')!;
  const levothyroxine = proposal.doses.find(dose => dose.key === 'record:rec-levothyroxine')!;
  assert.ok(ironDose.minute - levothyroxine.minute >= 240);
  assert.deepEqual(ironDose.notes.at(-1), { code: 'apart-from', key: 'record:rec-levothyroxine', hours: 4 });
});

test('gives times to every daily item, including ones not matched to the list', () => {
  const additions: PatientAddition[] = [
    { id: 'turmeric', name: 'Turmeric', strength: '500mg', dose: { quantity: 1, unit: 'capsule' }, frequency: 'twice-daily' },
    { id: 'ibuprofen', productId: 'ibuprofen-200mg-tablet', name: 'Ibuprofen', strength: '', dose: { quantity: 1, quantityMax: 2, unit: 'tablet' }, frequency: 'as-needed' },
  ];
  const proposal = createProposal({ routine, record: PATIENT_RECORD, selectedRecordIds: [], additions });
  assert.deepEqual(times(proposal), ['07:00 patient:turmeric', '19:00 patient:turmeric']);
  assert.deepEqual(proposal.whenNeeded, ['patient:ibuprofen']);
  assert.equal(proposal.items[0].strength, '500mg');
  assert.equal(proposal.items[0].matched, false);
  assert.equal(proposal.items[1].strength, '200mg');
});

test('the day timeline shows waking, meals and bedtime with doses merged in', () => {
  const proposal = createProposal({ routine, record: PATIENT_RECORD, selectedRecordIds: allRecord, additions: [] });
  assert.equal(proposal.status, 'ok');
  if (proposal.status !== 'ok') return;
  const timeline = dayTimeline(routine, proposal.doses);
  assert.deepEqual(timeline.map(entry => `${entry.time} ${entry.events.join('+')} ${entry.doses.length}`), [
    '07:00 wake 2', '08:00 breakfast 1', '13:00 lunch 0', '18:30 dinner 2', '22:30 sleep 0',
  ]);
  const skipped = dayTimeline({ ...routine, meals: { ...routine.meals, lunch: null } }, []);
  assert.deepEqual(skipped.flatMap(entry => entry.events), ['wake', 'breakfast', 'dinner', 'sleep']);
});

test('orders doses after midnight at the end of the day', () => {
  const lateRoutine: Routine = { wake: '10:00', sleep: '01:00', meals: { breakfast: '10:30', lunch: '15:00', dinner: '21:00' } };
  const addition: PatientAddition = { id: 'simva', productId: 'simvastatin-40mg-tablet', name: 'Simvastatin', strength: '', dose: { quantity: 1, unit: 'tablet' }, frequency: 'once-daily' };
  const proposal = createProposal({ routine: lateRoutine, record: PATIENT_RECORD, selectedRecordIds: ['rec-atorvastatin', 'rec-metformin'], additions: [addition] });
  assert.equal(proposal.status, 'ok');
  if (proposal.status !== 'ok') return;
  const minutes = proposal.doses.map(dose => dose.minute);
  assert.deepEqual(minutes, [...minutes].sort((a, b) => a - b));
  assert.ok(groupByTime(proposal.doses).length <= proposal.doses.length);
});

test('the independent checker rejects schedules that break a rule', () => {
  const day = toDay(routine);
  const { timed } = classify(PATIENT_RECORD, allRecord, [iron]);
  const constraints = buildConstraints(timed, day);
  const good = createProposal({ routine, record: PATIENT_RECORD, selectedRecordIds: allRecord, additions: [iron] });
  assert.equal(good.status, 'ok');
  if (good.status !== 'ok') return;
  const assignment: Record<string, number[]> = {};
  for (const dose of good.doses) (assignment[dose.key] ??= []).push(dose.minute);
  assert.ok(checkAssignment(constraints, day, assignment).every(check => check.pass));

  const failed = (changed: Record<string, number[]>) => checkAssignment(constraints, day, { ...assignment, ...changed }).filter(check => !check.pass).map(check => `${check.key} ${check.rule}`);
  assert.deepEqual(failed({ 'patient:iron': [day.wake + 60] }), ['record:rec-levothyroxine separation', 'patient:iron separation']);
  assert.deepEqual(failed({ 'record:rec-metformin': [day.meals.breakfast!, day.meals.breakfast! + 30] }), ['record:rec-metformin food', 'record:rec-metformin interval']);
  assert.deepEqual(failed({ 'record:rec-levothyroxine': [day.meals.breakfast! - 10] }), ['record:rec-levothyroxine window', 'record:rec-levothyroxine food']);
  assert.deepEqual(failed({ 'record:rec-amlodipine': [] }), ['record:rec-amlodipine dose-count']);
  assert.deepEqual(failed({ unknown: [day.wake] }), ['unknown unexpected-item']);
});

test('every proposal across many routines either passes all checks or explains why not', () => {
  let seed = 7;
  const random = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
  const additions: PatientAddition[] = [iron, { id: 'calcium', productId: 'calcium-vitd-chewable', name: 'Adcal-D3', strength: '', dose: { quantity: 1, unit: 'tablet' }, frequency: 'twice-daily' }];
  for (let run = 0; run < 150; run++) {
    const wake = 300 + random(300);
    const meal = (offset: number) => (random(5) === 0 ? null : formatClockTime(wake + offset + random(60)));
    const candidate: Routine = { wake: formatClockTime(wake), sleep: formatClockTime(wake + 900 + random(240)), meals: { breakfast: meal(30), lunch: meal(330), dinner: meal(660) } };
    const proposal = createProposal({ routine: candidate, record: PATIENT_RECORD, selectedRecordIds: allRecord, additions: additions.slice(0, random(3)) });
    if (proposal.status === 'ok') assert.ok(proposal.checks.every(check => check.pass));
    else assert.ok(proposal.problems.length > 0);
  }
});
