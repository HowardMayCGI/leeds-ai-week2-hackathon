/** Minute-resolution, bounded feasibility search for a repeating daily plan. No clinical rules live here. */
export interface DailyConstraint {
  id: string;
  doses: number;
  allowedMinutes: number[];
  preferredMinutes: number[];
  minimumGapMinutes: number;
}

export interface DailyRelation {
  from: string;
  to: string;
  minimumGapMinutes: number;
  direction: "either_order" | "before";
}

export type DailyPlan =
  | { status: "ok"; times: Record<string, number[]> }
  | { status: "unsatisfiable" | "search_limit" };

/** Gaps apply to the preceding and following day's doses, too. */
function circularGap(a: number, b: number): number {
  const distance = Math.abs(a - b) % 1440;
  return Math.min(distance, 1440 - distance);
}

export function planDaily(
  constraints: DailyConstraint[],
  relations: DailyRelation[],
  nodeLimit = 200_000,
): DailyPlan {
  if (
    constraints.some(
      (c) => c.allowedMinutes.length < c.doses || c.minimumGapMinutes * c.doses > 1440,
    )
  )
    return { status: "unsatisfiable" };
  // A cycle of strictly positive "before" gaps is impossible irrespective of candidate times.
  const before = relations.filter(
    (relation) => relation.direction === "before" && relation.minimumGapMinutes > 0,
  );
  const remaining = new Map(
    constraints.map((c) => [c.id, before.filter((relation) => relation.to === c.id).length]),
  );
  const queue = constraints.filter((c) => remaining.get(c.id) === 0).map((c) => c.id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const relation of before.filter((relation) => relation.from === id)) {
      const count = remaining.get(relation.to)! - 1;
      remaining.set(relation.to, count);
      if (count === 0) queue.push(relation.to);
    }
  }
  if (visited !== constraints.length) return { status: "unsatisfiable" };
  const ordered = [...constraints].sort(
    (a, b) =>
      a.allowedMinutes.length / a.doses - b.allowedMinutes.length / b.doses ||
      a.id.localeCompare(b.id),
  );
  const times: Record<string, number[]> = Object.create(null);
  let nodes = 0;
  let exhausted = false;
  const candidates = new Map(
    ordered.map((c) => {
      const preferred = new Set(c.preferredMinutes);
      const first = c.allowedMinutes[0] ?? 0;
      return [
        c.id,
        Array.from({ length: c.doses }, (_, dose) =>
          [...c.allowedMinutes].sort(
            (a, b) =>
              Number(preferred.has(b)) - Number(preferred.has(a)) ||
              Math.abs(a - first - (dose * 1440) / c.doses) -
                Math.abs(b - first - (dose * 1440) / c.doses) ||
              a - b,
          ),
        ),
      ];
    }),
  );

  const fitsRelations = (id: string, minute: number) =>
    relations.every((relation) => {
      if (relation.from !== id && relation.to !== id) return true;
      const otherId = relation.from === id ? relation.to : relation.from;
      return (times[otherId] ?? []).every((other) => {
        if (circularGap(minute, other) < relation.minimumGapMinutes) return false;
        if (relation.direction === "either_order") return true;
        return relation.from === id
          ? other - minute >= relation.minimumGapMinutes
          : minute - other >= relation.minimumGapMinutes;
      });
    });

  const visit = (index: number): boolean => {
    if (index === ordered.length) return true;
    const constraint = ordered[index];
    times[constraint.id] = [];
    const selected = times[constraint.id];
    const pick = (dose: number): boolean => {
      if (dose === constraint.doses) return visit(index + 1);
      for (const minute of candidates.get(constraint.id)![dose]) {
        if (++nodes > nodeLimit) {
          exhausted = true;
          return false;
        }
        if (selected.length && minute <= selected[selected.length - 1]) continue;
        if (selected.some((other) => circularGap(minute, other) < constraint.minimumGapMinutes))
          continue;
        // Even zero-gap regimens require distinct times; reserve space for remaining doses.
        if (
          minute + (constraint.doses - dose - 1) * Math.max(1, constraint.minimumGapMinutes) >
          constraint.allowedMinutes.at(-1)!
        )
          continue;
        if (!fitsRelations(constraint.id, minute)) continue;
        selected.push(minute);
        if (pick(dose + 1)) return true;
        selected.pop();
        if (exhausted) return false;
      }
      return false;
    };
    if (pick(0)) return true;
    delete times[constraint.id];
    return false;
  };
  if (visit(0)) return { status: "ok", times };
  return { status: exhausted ? "search_limit" : "unsatisfiable" };
}
