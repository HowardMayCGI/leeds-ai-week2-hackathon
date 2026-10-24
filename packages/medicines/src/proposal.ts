import { CATALOGUE_VERSION } from './catalogue';
import { checkAssignment, type Check } from './checker';
import { buildConstraints, classify, type Constraint, type ItemSnapshot, type PatientAddition } from './items';
import type { RecordMedicine } from './record';
import { MEALS, toDay, type Day, type Meal, type Routine } from './routine';
import { RULES_VERSION } from './rules';
import { schedule, type Problem } from './scheduler';
import { formatClockTime, type ClockTime } from './time';

export type DoseNote =
  | { code: 'with-meal'; meal: Meal }
  | { code: 'at-meal-time'; meal: Meal }
  | { code: 'before-meal'; meal: Meal; minutes: number }
  | { code: 'empty-stomach' }
  | { code: 'on-waking' }
  | { code: 'at-bedtime' }
  | { code: 'apart-from'; key: string; hours: number };

export interface ScheduledDose {
  time: ClockTime;
  /** Minutes from the midnight before waking; orders doses after midnight correctly. */
  minute: number;
  key: string;
  notes: DoseNote[];
}

interface ProposalBase {
  routine: Routine;
  items: ItemSnapshot[];
  /** Items taken only when needed, which have no set times. */
  whenNeeded: string[];
  rulesVersion: string;
  catalogueVersion: string;
}

export type Proposal =
  | (ProposalBase & { status: 'ok'; doses: ScheduledDose[]; checks: Check[] })
  | (ProposalBase & { status: 'blocked'; problems: Problem[] });

export interface ProposalInputs {
  routine: Routine;
  record: RecordMedicine[];
  selectedRecordIds: string[];
  additions: PatientAddition[];
}

function notesFor(minute: number, constraint: Constraint, day: Day, times: Record<string, number[]>): DoseNote[] {
  const notes: DoseNote[] = [];
  const mealAt = MEALS.find(meal => day.meals[meal] === minute);
  if (constraint.food === 'with-food' && mealAt) notes.push({ code: 'with-meal', meal: mealAt });
  else if (constraint.food === 'empty-stomach') {
    const next = MEALS.map(meal => ({ meal, time: day.meals[meal] })).find(({ time }) => time !== undefined && time > minute);
    // Only name the meal when it is close enough to be a useful cue.
    notes.push(next && next.time! - minute <= 60 ? { code: 'before-meal', meal: next.meal, minutes: next.time! - minute } : { code: 'empty-stomach' });
  } else if (mealAt) notes.push({ code: 'at-meal-time', meal: mealAt });
  if (minute === day.wake && !notes.some(note => note.code === 'before-meal' || note.code === 'with-meal')) notes.unshift({ code: 'on-waking' });
  if (minute === day.sleep) notes.push({ code: 'at-bedtime' });
  for (const { key, hours } of constraint.separations) if (times[key]) notes.push({ code: 'apart-from', key, hours });
  return notes;
}

/** Builds a proposal from confirmed inputs. A blocked proposal explains why and is never saveable. */
export function createProposal(inputs: ProposalInputs): Proposal {
  const day = toDay(inputs.routine);
  const { items, timed, whenNeeded } = classify(inputs.record, inputs.selectedRecordIds, inputs.additions);
  const base: ProposalBase = { routine: inputs.routine, items, whenNeeded, rulesVersion: RULES_VERSION, catalogueVersion: CATALOGUE_VERSION };
  const constraints = buildConstraints(timed, day);
  const result = schedule(constraints, day);
  if (result.status === 'blocked') return { ...base, status: 'blocked', problems: result.problems };

  const checks = checkAssignment(constraints, day, result.times);
  // The independent checks guard the scheduler; a failure is never shown as a schedule.
  if (checks.some(check => !check.pass)) return { ...base, status: 'blocked', problems: [{ code: 'too-complex' }] };

  const order = new Map(items.map((item, index) => [item.key, index]));
  const doses = constraints
    .flatMap(constraint => result.times[constraint.key].map(minute => ({
      time: formatClockTime(minute), minute, key: constraint.key, notes: notesFor(minute, constraint, day, result.times),
    })))
    .sort((a, b) => a.minute - b.minute || order.get(a.key)! - order.get(b.key)!);
  return { ...base, status: 'ok', doses, checks };
}

/** Groups doses taken at the same time, in order through the day. */
export function groupByTime(doses: ScheduledDose[]): { time: ClockTime; minute: number; doses: ScheduledDose[] }[] {
  const groups: { time: ClockTime; minute: number; doses: ScheduledDose[] }[] = [];
  for (const dose of doses) {
    const last = groups[groups.length - 1];
    if (last && last.minute === dose.minute) last.doses.push(dose);
    else groups.push({ time: dose.time, minute: dose.minute, doses: [dose] });
  }
  return groups;
}

export type RoutineEvent = 'wake' | Meal | 'sleep';

export interface TimelineEntry {
  time: ClockTime;
  minute: number;
  /** Parts of the patient's day at this time, such as waking up or a meal. */
  events: RoutineEvent[];
  doses: ScheduledDose[];
}

/** The patient's day in order: waking, meals and bedtime, with doses at the same time merged in. */
export function dayTimeline(routine: Routine, doses: ScheduledDose[]): TimelineEntry[] {
  const day = toDay(routine);
  const entries = new Map<number, TimelineEntry>();
  const entry = (minute: number) => {
    if (!entries.has(minute)) entries.set(minute, { time: formatClockTime(minute), minute, events: [], doses: [] });
    return entries.get(minute)!;
  };
  entry(day.wake).events.push('wake');
  for (const meal of MEALS) if (day.meals[meal] !== undefined) entry(day.meals[meal]!).events.push(meal);
  for (const dose of doses) entry(dose.minute).doses.push(dose);
  entry(day.sleep).events.push('sleep');
  return [...entries.values()].sort((a, b) => a.minute - b.minute);
}
