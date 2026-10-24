import assert from "node:assert/strict";
import { test } from "node:test";
import { planDaily, type DailyConstraint, type DailyRelation } from "./daily-plan";
import { verifyDailyPlan } from "./daily-plan-checker";

const constraint = (id: string, allowedMinutes: number[], doses = 1, gap = 0): DailyConstraint => ({
  id,
  allowedMinutes,
  doses,
  minimumGapMinutes: gap,
  preferredMinutes: [],
});

test("honours exact minute candidates, directional order and required gaps", () => {
  const constraints = [constraint("first", [480]), constraint("second", [480, 500, 517])];
  const relations: DailyRelation[] = [
    { from: "first", to: "second", minimumGapMinutes: 37, direction: "before" },
  ];
  const result = planDaily(constraints, relations);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.times.second, [517]);
  assert.ok(verifyDailyPlan(constraints, relations, result.times));
});

test("checks separation across successive days, not just adjacent doses within a day", () => {
  const constraints = [constraint("morning", [420]), constraint("late", [1380])];
  const relations: DailyRelation[] = [
    { from: "morning", to: "late", minimumGapMinutes: 600, direction: "either_order" },
  ];
  assert.equal(planDaily(constraints, relations).status, "unsatisfiable");
  assert.equal(verifyDailyPlan(constraints, relations, { morning: [420], late: [1380] }), false);
});

test("same medicine intervals include the last dose to the next first dose", () => {
  const constraints = [constraint("twice", [420, 1380], 2, 600)];
  assert.equal(planDaily(constraints, []).status, "unsatisfiable");
  assert.equal(verifyDailyPlan(constraints, [], { twice: [420, 1380] }), false);
  const good = [constraint("twice", [420, 1140], 2, 600)];
  assert.equal(planDaily(good, []).status, "ok");
});

test("detects cycles, insufficient candidates and search exhaustion separately", () => {
  const constraints = [constraint("a", [420, 480]), constraint("b", [420, 480])];
  const relations: DailyRelation[] = [
    { from: "a", to: "b", minimumGapMinutes: 30, direction: "before" },
    { from: "b", to: "a", minimumGapMinutes: 30, direction: "before" },
  ];
  assert.equal(planDaily(constraints, relations).status, "unsatisfiable");
  assert.equal(planDaily([constraint("a", [], 1)], []).status, "unsatisfiable");
  assert.equal(planDaily(constraints, [], 0).status, "search_limit");
});

test("independent verification rejects wrong counts, unexpected IDs, times and ordering", () => {
  const constraints = [constraint("a", [420, 480]), constraint("b", [420, 480])];
  const relations: DailyRelation[] = [
    { from: "a", to: "b", minimumGapMinutes: 30, direction: "before" },
  ];
  assert.equal(verifyDailyPlan(constraints, relations, { a: [420], b: [480] }), true);
  const invalid: Record<string, number[]>[] = [
    { a: [], b: [480] },
    { a: [420], b: [481] },
    { a: [480], b: [420] },
    { a: [420], b: [480], unknown: [500] },
  ];
  for (const times of invalid) assert.equal(verifyDailyPlan(constraints, relations, times), false);
});

test("matches exhaustive feasibility on small varied domains", () => {
  for (let run = 0; run < 60; run++) {
    const constraints = ["a", "b", "c"].map((id, index) =>
      constraint(
        id,
        [420, 480, 540].filter((_, i) => (run + index + i) % 4 !== 0),
      ),
    );
    const relations: DailyRelation[] = [
      {
        from: "a",
        to: "b",
        minimumGapMinutes: (run % 3) * 60,
        direction: run % 2 ? "before" : "either_order",
      },
      { from: "b", to: "c", minimumGapMinutes: ((run + 1) % 3) * 60, direction: "either_order" },
    ];
    let exists = false;
    for (const a of constraints[0].allowedMinutes)
      for (const b of constraints[1].allowedMinutes)
        for (const c of constraints[2].allowedMinutes)
          if (verifyDailyPlan(constraints, relations, { a: [a], b: [b], c: [c] })) exists = true;
    const result = planDaily(constraints, relations);
    assert.equal(result.status === "ok", exists, `run ${run}`);
    if (result.status === "ok") assert.ok(verifyDailyPlan(constraints, relations, result.times));
  }
});
