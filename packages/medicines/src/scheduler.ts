/**
 * Deterministic scheduler, adapted from the earlier medplanner prototype. It
 * finds dose times that meet every constraint and keep the day simple. It
 * never relaxes a constraint: if no assignment exists it says why instead.
 */
import type { Constraint, Separation } from './items';
import { MEALS, type Day, type Meal } from './routine';

const SEARCH_NODE_LIMIT = 200_000;

export type Problem =
  | { code: 'meal-skipped'; key: string; meal: Meal }
  | { code: 'not-enough-meals'; key: string; doses: number; meals: number }
  | { code: 'not-enough-time'; key: string; doses: number; hours: number }
  | { code: 'no-suitable-time'; key: string }
  | { code: 'cannot-separate'; keys: [string, string]; hours: number }
  | { code: 'cannot-take-first'; keys: [first: string, then: string]; minutes: number }
  | { code: 'too-complex' };

export type Assignment = Record<string, number[]>;
export type SchedulerResult = { status: 'ok'; times: Assignment } | { status: 'blocked'; problems: Problem[] };

export function foodAllows(minute: number, constraint: Constraint, day: Day): boolean {
  if (constraint.food === 'with-food') return constraint.meals.some(meal => day.meals[meal] === minute);
  if (constraint.food === 'empty-stomach') {
    const { beforeMinutes, afterMinutes } = constraint.emptyStomach;
    return MEALS.every(meal => {
      const time = day.meals[meal];
      return time === undefined || minute <= time - beforeMinutes || minute >= time + afterMinutes;
    });
  }
  return true;
}

/** Candidate times: routine events, common offsets around meals and each hour of the waking day. */
function anchors(day: Day, constraint: Constraint): number[] {
  const set = new Set([day.wake, day.sleep, ...constraint.window]);
  for (const meal of MEALS) {
    const time = day.meals[meal];
    if (time === undefined) continue;
    for (const offset of [-60, -30, 0, 60, 120, 180]) set.add(time + offset);
  }
  for (let hour = Math.ceil(day.wake / 60) * 60; hour <= day.sleep; hour += 60) set.add(hour);
  return [...set].sort((a, b) => a - b);
}

export function candidateTimes(constraint: Constraint, day: Day): number[] {
  if (constraint.missingMeal) return [];
  const [from, to] = constraint.window;
  return anchors(day, constraint).filter(minute => minute >= from && minute <= to && minute >= day.wake && minute <= day.sleep && foodAllows(minute, constraint, day));
}

function doseSets(constraint: Constraint, day: Day): number[][] {
  const candidates = candidateTimes(constraint, day);
  const gap = Math.max(1, constraint.minIntervalMinutes);
  const sets: number[][] = [];
  const pick = (start: number, chosen: number[]) => {
    if (chosen.length === constraint.doses) { sets.push([...chosen]); return; }
    for (let i = start; i < candidates.length; i++) {
      if (chosen.length && candidates[i] - chosen[chosen.length - 1] < gap) continue;
      chosen.push(candidates[i]);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return sets;
}

function separated(mine: number[], theirs: number[], { hours, order }: Separation): boolean {
  const gap = hours * 60;
  return mine.every(x => theirs.every(y => (order === 'before' ? y - x : order === 'after' ? x - y : Math.abs(x - y)) >= gap));
}

function spacingPenalty(times: number[]): number {
  const ideal = (24 * 60) / times.length;
  let penalty = 0;
  for (let i = 1; i < times.length; i++) penalty += Math.abs(times[i] - times[i - 1] - ideal);
  return penalty;
}

/** Lexicographic cost: fewest separate times, even spacing, times on routine events, then earliest. */
function cost(assignment: Assignment, day: Day): number[] {
  const all = Object.values(assignment).flat();
  const distinct = new Set(all);
  const events = new Set([day.wake, day.sleep, ...Object.values(day.meals)]);
  return [
    distinct.size,
    Object.values(assignment).reduce((sum, times) => sum + spacingPenalty(times), 0),
    [...distinct].filter(minute => !events.has(minute)).length,
    all.reduce((sum, minute) => sum + minute - day.wake, 0),
  ];
}

function lessThan(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

function search(constraints: Constraint[], sets: number[][][], day: Day) {
  const order = constraints.map((_, i) => i).sort((i, j) => sets[i].length - sets[j].length || constraints[i].key.localeCompare(constraints[j].key));
  const events = new Set([day.wake, day.sleep, ...Object.values(day.meals)]);
  const candidates = sets.map(options => [...new Set(options.flat())]);
  let best: Assignment | null = null;
  let bestCost: number[] | null = null;
  let nodes = 0;
  let limitHit = false;
  const assignment: Assignment = {};
  const used = new Map<number, number>();

  // At least this many separate times: those used so far, plus the new times the neediest remaining medicine must add.
  const lowerBound = (depth: number) => {
    let extra = 0;
    for (let d = depth; d < order.length; d++) {
      const i = order[d];
      const free = candidates[i].filter(minute => used.has(minute)).length;
      extra = Math.max(extra, constraints[i].doses - free);
    }
    return used.size + extra;
  };
  // Try times already in the schedule first, then routine events, so a simple schedule is found early.
  const added = (times: number[]) => times.filter(minute => !used.has(minute)).length;
  const offEvent = (times: number[]) => times.filter(minute => !events.has(minute)).length;

  const visit = (depth: number) => {
    if (++nodes > SEARCH_NODE_LIMIT) { limitHit = true; return; }
    if (bestCost && lowerBound(depth) > bestCost[0]) return;
    if (depth === order.length) {
      const total = cost(assignment, day);
      if (!bestCost || lessThan(total, bestCost)) { bestCost = total; best = structuredClone(assignment); }
      return;
    }
    const constraint = constraints[order[depth]];
    const ranked = sets[order[depth]].map(times => ({ times, added: added(times), offEvent: offEvent(times) }))
      .sort((a, b) => a.added - b.added || a.offEvent - b.offEvent);
    // Ranking takes work too, so it counts towards the limit.
    nodes += ranked.length >> 4;
    for (const { times } of ranked) {
      const fits = constraint.separations.every(separation => !assignment[separation.key] || separated(times, assignment[separation.key], separation));
      if (!fits) continue;
      assignment[constraint.key] = times;
      for (const minute of times) used.set(minute, (used.get(minute) ?? 0) + 1);
      visit(depth + 1);
      for (const minute of times) {
        const count = used.get(minute)! - 1;
        if (count) used.set(minute, count); else used.delete(minute);
      }
      delete assignment[constraint.key];
      if (limitHit) return;
    }
  };
  visit(0);
  return { best: best as Assignment | null, limitHit };
}

function explainSingle(constraint: Constraint, day: Day): Problem {
  if (constraint.missingMeal) return { code: 'meal-skipped', key: constraint.key, meal: constraint.missingMeal };
  const available = constraint.meals.filter(meal => day.meals[meal] !== undefined).length;
  if (constraint.food === 'with-food' && available < constraint.doses) {
    return { code: 'not-enough-meals', key: constraint.key, doses: constraint.doses, meals: available };
  }
  if (constraint.doses > 1 && candidateTimes(constraint, day).length >= constraint.doses) {
    return { code: 'not-enough-time', key: constraint.key, doses: constraint.doses, hours: constraint.minIntervalMinutes / 60 };
  }
  return { code: 'no-suitable-time', key: constraint.key };
}

export function schedule(constraints: Constraint[], day: Day): SchedulerResult {
  const sets = constraints.map(constraint => doseSets(constraint, day));
  const single = constraints.flatMap((constraint, i) => (sets[i].length ? [] : [explainSingle(constraint, day)]));
  if (single.length) return { status: 'blocked', problems: single };

  const result = search(constraints, sets, day);
  if (result.best) return { status: 'ok', times: result.best };
  if (result.limitHit) return { status: 'blocked', problems: [{ code: 'too-complex' }] };

  // Find which pairs cannot be kept apart, to explain the conflict.
  const problems: Problem[] = [];
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const rule = constraints[i].separations.find(separation => separation.key === constraints[j].key);
      if (!rule || search([constraints[i], constraints[j]], [sets[i], sets[j]], day).best) continue;
      const keys: [string, string] = [constraints[i].key, constraints[j].key];
      if (!rule.order) problems.push({ code: 'cannot-separate', keys, hours: rule.hours });
      else problems.push({ code: 'cannot-take-first', keys: rule.order === 'before' ? keys : [keys[1], keys[0]], minutes: rule.hours * 60 });
    }
  }
  return { status: 'blocked', problems: problems.length ? problems : [{ code: 'too-complex' }] };
}
