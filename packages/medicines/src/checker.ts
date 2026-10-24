/**
 * Independent checks on a proposed schedule. Deliberately does not import the
 * scheduler, so a scheduler bug is not silently shared. It confirms the times
 * meet the encoded rules; it cannot prove the rules or medicine list are right.
 */
import type { Constraint } from './items';
import { MEALS, type Day } from './routine';

export interface Check {
  key: string;
  rule: 'dose-count' | 'waking-day' | 'window' | 'food' | 'interval' | 'separation' | 'unexpected-item';
  pass: boolean;
}

export function checkAssignment(constraints: Constraint[], day: Day, times: Record<string, number[]>): Check[] {
  const checks: Check[] = [];
  const add = (key: string, rule: Check['rule'], pass: boolean) => checks.push({ key, rule, pass });
  const mealTimes = MEALS.flatMap(meal => (day.meals[meal] === undefined ? [] : [day.meals[meal]!]));

  for (const key of Object.keys(times)) add(key, 'unexpected-item', constraints.some(constraint => constraint.key === key));

  for (const constraint of constraints) {
    const doses = [...(times[constraint.key] ?? [])].sort((a, b) => a - b);
    add(constraint.key, 'dose-count', doses.length === constraint.doses && new Set(doses).size === doses.length);
    add(constraint.key, 'waking-day', doses.every(minute => minute >= day.wake && minute <= day.sleep));
    add(constraint.key, 'window', doses.every(minute => minute >= constraint.window[0] && minute <= constraint.window[1]));

    if (constraint.food === 'with-food') {
      const allowed = constraint.meals.map(meal => day.meals[meal]).filter(minute => minute !== undefined);
      add(constraint.key, 'food', doses.every(minute => allowed.includes(minute)));
    } else if (constraint.food === 'empty-stomach') {
      const { beforeMinutes, afterMinutes } = constraint.emptyStomach;
      add(constraint.key, 'food', doses.every(minute => mealTimes.every(meal => minute <= meal - beforeMinutes || minute >= meal + afterMinutes)));
    }

    if (constraint.minIntervalMinutes) {
      add(constraint.key, 'interval', doses.every((minute, i) => i === 0 || minute - doses[i - 1] >= constraint.minIntervalMinutes));
    }
    for (const { key, hours } of constraint.separations) {
      const other = times[key] ?? [];
      add(constraint.key, 'separation', doses.every(a => other.every(b => Math.abs(a - b) >= hours * 60)));
    }
  }
  return checks;
}
