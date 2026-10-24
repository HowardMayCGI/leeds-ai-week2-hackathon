import { MINUTES_PER_DAY, parseClockTime, type ClockTime } from './time';

export const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
export type Meal = (typeof MEALS)[number];

/** One usual day. A meal set to `null` is one the patient does not usually eat. */
export interface Routine {
  wake: ClockTime;
  sleep: ClockTime;
  meals: Record<Meal, ClockTime | null>;
}

/**
 * The routine as minutes from the midnight before waking. Anything earlier than
 * the waking time is treated as the following morning, so going to sleep at
 * 00:30 becomes 1470.
 */
export interface Day {
  wake: number;
  sleep: number;
  meals: Partial<Record<Meal, number>>;
}

function afterWake(value: ClockTime, wake: number): number {
  const minutes = parseClockTime(value);
  if (minutes === null) throw new Error(`Invalid time "${value}"`);
  return minutes < wake ? minutes + MINUTES_PER_DAY : minutes;
}

export function toDay(routine: Routine): Day {
  const wake = parseClockTime(routine.wake);
  if (wake === null) throw new Error(`Invalid time "${routine.wake}"`);
  const meals: Day['meals'] = {};
  for (const meal of MEALS) {
    const time = routine.meals[meal];
    if (time !== null) meals[meal] = afterWake(time, wake);
  }
  return { wake, sleep: afterWake(routine.sleep, wake), meals };
}

export type RoutineIssue =
  | { code: 'sleep-same-as-wake' }
  | { code: 'meal-outside-waking-day'; meal: Meal }
  | { code: 'meals-out-of-order'; meal: Meal; previous: Meal };

/**
 * Cross-field checks the scheduler relies on. Detailed rules, including
 * overnight routines, are follow-on work, so this keeps to the essentials.
 */
export function checkRoutine(routine: Routine): RoutineIssue[] {
  const day = toDay(routine);
  if (day.sleep === day.wake) return [{ code: 'sleep-same-as-wake' }];
  const issues: RoutineIssue[] = [];
  let previous: Meal | undefined;
  for (const meal of MEALS) {
    const time = day.meals[meal];
    if (time === undefined) continue;
    if (time > day.sleep) { issues.push({ code: 'meal-outside-waking-day', meal }); continue; }
    if (previous && time <= day.meals[previous]!) issues.push({ code: 'meals-out-of-order', meal, previous });
    previous = meal;
  }
  return issues;
}
