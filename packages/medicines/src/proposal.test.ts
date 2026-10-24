import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toMedicineOption } from './catalogue';
import { checkAssignment } from './checker';
import { buildConstraints, classify, type PatientAddition, type RecordDetails } from './items';
import { createProposal, dayTimeline, groupByTime, type Proposal } from './proposal';
import { toRecordMedicine, type SourceMedication } from './record';
import { toDay, type Routine } from './routine';
import { formatClockTime } from './time';

const routine: Routine = { wake: '07:00', sleep: '22:30', meals: { breakfast: '08:00', lunch: '13:00', dinner: '18:30' } };
const daily = (frequency: number, period = 1) => ({ frequency, period, periodUnit: 'd' });
const tablet = { value: 1, unit: 'tablet' };
const source = (id: string, name: string, changes: Partial<SourceMedication> = {}): SourceMedication => ({ id, code: id, name, asNeeded: false, instructions: [], ...changes });

// A record shaped like the patient data: some complete, some missing details.
const RECORD = [
  source('levo', 'Levothyroxine sodium 75microgram tablets', { dose: tablet, frequency: daily(1) }),
  source('lisinopril', 'lisinopril 10 MG Oral Tablet', { dose: tablet, frequency: daily(1) }),
  source('simva', 'Simvastatin 20mg tablets', { dose: tablet, frequency: daily(1) }),
  source('oxy', 'Oxycodone 10mg capsules', { dose: { value: 1, unit: 'capsule' }, frequency: daily(4) }),
  source('patch', 'Fentanyl 25micrograms/hour transdermal patches', { dose: { value: 1, unit: 'patch' }, frequency: daily(1, 3) }),
  source('salbutamol', 'Salbutamol 100micrograms/dose inhaler CFC free', { asNeeded: true }),
  source('alendronic', 'Alendronic acid 10mg tablets'),
].map(toRecordMedicine);
const ALL = RECORD.map(medicine => medicine.id);
const DETAILS: Record<string, RecordDetails> = { alendronic: { dose: { quantity: 1, unit: 'tablet' }, frequency: 'once-daily' } };

const naproxen = toMedicineOption({ code: '1217387008', name: 'Naproxen 250mg tablets' });
const iron = toMedicineOption({ code: '39107411000001105', name: 'Ferrous sulfate 325mg modified-release tablets' });
const addition = (changes: Partial<PatientAddition>): PatientAddition => ({
  id: 'naproxen', medicine: naproxen, name: 'Naproxen', strength: '250mg', dose: { quantity: 1, unit: 'tablet' }, frequency: 'twice-daily', timing: 'with-food', ...changes,
});

function times(proposal: Proposal) {
  assert.equal(proposal.status, 'ok', JSON.stringify(proposal.status === 'blocked' && proposal.problems));
  return proposal.status === 'ok' ? proposal.doses.map(dose => `${dose.time} ${dose.key}`) : [];
}
const doseTimes = (proposal: Proposal, key: string) => (proposal.status === 'ok' ? proposal.doses.filter(dose => dose.key === key).map(dose => dose.time) : []);

test('creates a schedule around the usual day that follows each medicine\'s rules', () => {
  const proposal = createProposal({ routine, record: RECORD, selectedRecordIds: ALL, additions: [], recordDetails: DETAILS });
  // Alendronic acid goes first, on an empty stomach, and other tablets come at least 30 minutes later.
  assert.deepEqual(doseTimes(proposal, 'record:alendronic'), ['07:00']);
  assert.deepEqual(doseTimes(proposal, 'record:levo'), ['07:30']);
  assert.ok(proposal.status === 'ok' && proposal.doses.filter(dose => dose.key !== 'record:alendronic').every(dose => dose.minute >= 450));
  const alendronic = proposal.status === 'ok' ? proposal.doses.find(dose => dose.key === 'record:alendronic') : undefined;
  assert.ok(alendronic?.notes.some(note => note.code === 'before-others' && note.minutes === 30));
  // Simvastatin is taken in the evening, at a time already in the schedule.
  const evening = doseTimes(proposal, 'record:simva')[0];
  assert.ok(evening >= '16:30');
  assert.ok(doseTimes(proposal, 'record:oxy').includes(evening));
  assert.equal(doseTimes(proposal, 'record:oxy').length, 4);
  assert.deepEqual(proposal.whenNeeded, ['record:salbutamol']);
  assert.deepEqual(proposal.notDaily, ['record:patch']);
  assert.ok(proposal.status === 'ok' && proposal.checks.every(check => check.pass));
  const simvastatin = proposal.status === 'ok' ? proposal.doses.find(dose => dose.key === 'record:simva') : undefined;
  assert.ok(simvastatin?.notes.some(note => note.code === 'in-evening' || note.code === 'at-bedtime'));
});

test('waits for the patient\'s details before scheduling a medicine the record has no frequency for', () => {
  const blocked = createProposal({ routine, record: RECORD, selectedRecordIds: ['alendronic'], additions: [] });
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(blocked.status === 'blocked' && blocked.problems, [{ code: 'missing-details', key: 'record:alendronic' }]);
  const ok = createProposal({ routine, record: RECORD, selectedRecordIds: ['alendronic'], additions: [], recordDetails: DETAILS });
  assert.deepEqual(times(ok), ['07:00 record:alendronic']);
  assert.equal(ok.items[0].detailsFromPatient, true);
});

test('only medicines the patient checked are included', () => {
  const proposal = createProposal({ routine, record: RECORD, selectedRecordIds: ['lisinopril'], additions: [] });
  assert.deepEqual(times(proposal), ['07:00 record:lisinopril']);
  assert.deepEqual(proposal.items.map(item => item.key), ['record:lisinopril']);
});

test('an added medicine that should be taken with food is given meal times', () => {
  const proposal = createProposal({ routine, record: RECORD, selectedRecordIds: [], additions: [addition({})] });
  assert.deepEqual(times(proposal), ['08:00 patient:naproxen', '18:30 patient:naproxen']);
  assert.deepEqual(proposal.status === 'ok' && proposal.doses[0].notes, [{ code: 'with-meal', meal: 'breakfast' }]);
});

test('the rule decides when a patient says before food, unless they choose to keep their own timing', () => {
  const followed = createProposal({ routine, record: RECORD, selectedRecordIds: [], additions: [addition({ timing: 'before-food' })] });
  assert.deepEqual(times(followed), ['08:00 patient:naproxen', '18:30 patient:naproxen']);
  assert.equal(followed.items[0].timingFlag, undefined);

  const kept = createProposal({ routine, record: RECORD, selectedRecordIds: [], additions: [addition({ timing: 'before-food', keepOwnTiming: true })] });
  assert.equal(kept.status, 'ok');
  assert.deepEqual(kept.items[0].timingFlag, { chosen: 'before-food', recommended: 'with-food' });
  if (kept.status === 'ok') assert.ok(kept.doses.every(dose => dose.notes.some(note => note.code === 'before-meal' || note.code === 'empty-stomach')));
});

test('an added medicine with no rule follows the timing the patient gave', () => {
  const clopidogrel = toMedicineOption({ code: '39689111000001106', name: 'Clopidogrel 75mg tablets' });
  const proposal = createProposal({ routine, record: RECORD, selectedRecordIds: [], additions: [addition({ id: 'c', medicine: clopidogrel, name: 'Clopidogrel', frequency: 'once-daily', timing: 'with-food' })] });
  assert.deepEqual(times(proposal), ['08:00 patient:c']);
});

test('keeps an added iron tablet apart from levothyroxine', () => {
  const ironAddition = addition({ id: 'iron', medicine: iron, name: 'Ferrous sulfate', frequency: 'once-daily', timing: 'any' });
  const proposal = createProposal({ routine, record: RECORD, selectedRecordIds: ['levo'], additions: [ironAddition] });
  assert.equal(proposal.status, 'ok');
  if (proposal.status !== 'ok') return;
  const ironDose = proposal.doses.find(dose => dose.key === 'patient:iron')!;
  const levothyroxine = proposal.doses.find(dose => dose.key === 'record:levo')!;
  assert.ok(ironDose.minute - levothyroxine.minute >= 240);
  assert.deepEqual(ironDose.notes.at(-1), { code: 'apart-from', key: 'record:levo', hours: 4 });
});

test('gives times to every daily item, including ones not matched to the list', () => {
  const additions: PatientAddition[] = [
    { id: 'turmeric', name: 'Turmeric', strength: '500mg', dose: { quantity: 1, unit: 'capsule' }, frequency: 'twice-daily', timing: 'not-sure' },
    addition({ id: 'pain', frequency: 'as-needed' }),
  ];
  const proposal = createProposal({ routine, record: RECORD, selectedRecordIds: [], additions });
  assert.deepEqual(times(proposal), ['07:00 patient:turmeric', '19:00 patient:turmeric']);
  assert.deepEqual(proposal.whenNeeded, ['patient:pain']);
  assert.equal(proposal.items[0].matched, false);
  assert.equal(proposal.items[1].strength, '250mg');
});

test('explains instead of relaxing a rule when no valid schedule exists', () => {
  const proposal = createProposal({
    routine: { ...routine, meals: { breakfast: null, lunch: null, dinner: '18:30' } }, record: RECORD, selectedRecordIds: [], additions: [addition({})],
  });
  assert.equal(proposal.status, 'blocked');
  assert.deepEqual(proposal.status === 'blocked' && proposal.problems, [{ code: 'not-enough-meals', key: 'patient:naproxen', doses: 2, meals: 1 }]);
});

test('the day timeline shows waking, meals and bedtime with doses merged in', () => {
  const proposal = createProposal({ routine, record: RECORD, selectedRecordIds: ['levo', 'lisinopril'], additions: [addition({})] });
  assert.equal(proposal.status, 'ok');
  if (proposal.status !== 'ok') return;
  const timeline = dayTimeline(routine, proposal.doses);
  assert.deepEqual(timeline.map(entry => `${entry.time} ${entry.events.join('+')} ${entry.doses.length}`), [
    '07:00 wake 2', '08:00 breakfast 1', '13:00 lunch 0', '18:30 dinner 1', '22:30 sleep 0',
  ]);
  const skipped = dayTimeline({ ...routine, meals: { ...routine.meals, lunch: null } }, []);
  assert.deepEqual(skipped.flatMap(entry => entry.events), ['wake', 'breakfast', 'dinner', 'sleep']);
});

test('orders doses after midnight at the end of the day', () => {
  const lateRoutine: Routine = { wake: '10:00', sleep: '01:00', meals: { breakfast: '10:30', lunch: '15:00', dinner: '21:00' } };
  const proposal = createProposal({ routine: lateRoutine, record: RECORD, selectedRecordIds: ['simva', 'oxy'], additions: [addition({})] });
  assert.equal(proposal.status, 'ok');
  if (proposal.status !== 'ok') return;
  const minutes = proposal.doses.map(dose => dose.minute);
  assert.deepEqual(minutes, [...minutes].sort((a, b) => a - b));
  assert.ok(groupByTime(proposal.doses).length <= proposal.doses.length);
});

test('the independent checker rejects schedules that break a rule', () => {
  const day = toDay(routine);
  const ironAddition = addition({ id: 'iron', medicine: iron, name: 'Ferrous sulfate', frequency: 'once-daily', timing: 'any' });
  const selected = ['levo', 'lisinopril'];
  const additions = [ironAddition, addition({})];
  const { timed } = classify(RECORD, selected, additions);
  const constraints = buildConstraints(timed, day);
  const good = createProposal({ routine, record: RECORD, selectedRecordIds: selected, additions });
  assert.equal(good.status, 'ok');
  if (good.status !== 'ok') return;
  const assignment: Record<string, number[]> = {};
  for (const dose of good.doses) (assignment[dose.key] ??= []).push(dose.minute);
  assert.ok(checkAssignment(constraints, day, assignment).every(check => check.pass));

  const failed = (changed: Record<string, number[]>) => checkAssignment(constraints, day, { ...assignment, ...changed }).filter(check => !check.pass).map(check => `${check.key} ${check.rule}`);
  assert.deepEqual(failed({ 'patient:iron': [day.wake + 60] }), ['record:levo separation', 'patient:iron separation']);
  assert.deepEqual(failed({ 'patient:naproxen': [day.meals.breakfast!, day.meals.breakfast! + 30] }), ['patient:naproxen food', 'patient:naproxen interval']);
  assert.deepEqual(failed({ 'record:levo': [day.meals.breakfast! - 10] }), ['record:levo window', 'record:levo food']);
  assert.deepEqual(failed({ 'record:lisinopril': [] }), ['record:lisinopril dose-count']);
  assert.deepEqual(failed({ unknown: [day.wake] }), ['unknown unexpected-item']);
});

test('every proposal across many routines either passes all checks or explains why not', () => {
  let seed = 7;
  const random = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
  const additions: PatientAddition[] = [
    addition({ id: 'iron', medicine: iron, name: 'Ferrous sulfate', frequency: 'once-daily', timing: 'any' }),
    addition({}),
    addition({ id: 'kept', timing: 'before-food', keepOwnTiming: true, frequency: 'once-daily' }),
  ];
  for (let run = 0; run < 150; run++) {
    const wake = 300 + random(300);
    const meal = (offset: number) => (random(5) === 0 ? null : formatClockTime(wake + offset + random(60)));
    const candidate: Routine = { wake: formatClockTime(wake), sleep: formatClockTime(wake + 900 + random(240)), meals: { breakfast: meal(30), lunch: meal(330), dinner: meal(660) } };
    const proposal = createProposal({ routine: candidate, record: RECORD, selectedRecordIds: ALL, additions: additions.slice(0, random(4)), recordDetails: DETAILS });
    if (proposal.status === 'ok') assert.ok(proposal.checks.every(check => check.pass));
    else assert.ok(proposal.problems.length > 0);
  }
});

test('says so when there is no time to take alendronic acid before other tablets', () => {
  const late = { ...routine, wake: '07:30' as const };
  const proposal = createProposal({ routine: late, record: RECORD, selectedRecordIds: ['alendronic', 'levo'], additions: [], recordDetails: DETAILS });
  assert.deepEqual(proposal.status === 'blocked' && proposal.problems, [{ code: 'cannot-take-first', keys: ['record:alendronic', 'record:levo'], minutes: 30 }]);
});
