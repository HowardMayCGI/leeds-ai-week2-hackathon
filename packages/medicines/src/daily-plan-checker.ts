import type { DailyConstraint, DailyRelation } from "./daily-plan";

/** Independent verification against adjacent-day copies; deliberately does not reuse the solver's gap predicate. */
export function verifyDailyPlan(
  constraints: DailyConstraint[],
  relations: DailyRelation[],
  times: Record<string, number[]>,
): boolean {
  if (Object.keys(times).some((id) => !constraints.some((c) => c.id === id))) return false;
  for (const constraint of constraints) {
    const doses = times[constraint.id] ?? [];
    if (doses.length !== constraint.doses || new Set(doses).size !== doses.length) return false;
    if (doses.some((time) => !Number.isInteger(time) || !constraint.allowedMinutes.includes(time)))
      return false;
    for (let i = 0; i < doses.length; i++) {
      if (1440 < constraint.minimumGapMinutes) return false;
      for (let j = 0; j < doses.length; j++) {
        for (const shift of [-1440, 0, 1440]) {
          if (i === j && shift === 0) continue;
          if (Math.abs(doses[i] - doses[j] - shift) < constraint.minimumGapMinutes) return false;
        }
      }
    }
  }
  for (const relation of relations) {
    if (!times[relation.from] || !times[relation.to]) return false;
    for (const a of times[relation.from])
      for (const b of times[relation.to]) {
        if (relation.direction === "before" && b - a < relation.minimumGapMinutes) return false;
        for (const shift of [-1440, 0, 1440])
          if (Math.abs(b - a + shift) < relation.minimumGapMinutes) return false;
      }
  }
  return true;
}
