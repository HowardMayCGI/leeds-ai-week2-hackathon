import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScheduleMedicine, ScheduleRequest, ScheduleResponse } from "@hackathon/api-contract";
import { createSchedule } from "./schedule-service";
import { validateScheduleRequest } from "./schedule-validation";
import { interactionDataset } from "./interactions";

const routine: ScheduleRequest["routine"] = {
  wake: "07:00",
  sleep: "22:30",
  meals: { breakfast: "08:00", lunch: "13:00", dinner: "18:30" },
};
const medicine = (id: string, code?: string): ScheduleMedicine => ({
  id,
  name: code
    ? interactionDataset.products.find((product) => product.code === code)!.name
    : "Unmatched supplement",
  source: "record",
  ...(code ? { code, system: "http://snomed.info/sct" } : {}),
  dose: { quantity: 1, unit: "tablet" },
  regimen: { kind: "daily", dosesPerDay: 1 },
});
function doses(result: ScheduleResponse) {
  assert.equal(result.status, "proposed", JSON.stringify(result.warnings));
  return result.schedule!.doses;
}

test("mixed record and user medicines receive doses with preserved quantities and source IDs", () => {
  const record = medicine("record-levo", "39698911000001100");
  const user = {
    ...medicine("user-iron", "39107411000001105"),
    source: "user" as const,
    dose: { quantity: 2, unit: "tablet" },
  };
  const request = { routine, medicines: [record, user] };
  const snapshot = JSON.stringify(request);
  const result = createSchedule(request);
  const schedule = doses(result);
  const levo = schedule.find((dose) => dose.medicineId === record.id)!;
  const iron = schedule.find((dose) => dose.medicineId === user.id)!;
  assert.ok(iron.minute - levo.minute >= 240);
  assert.ok(1440 - (iron.minute - levo.minute) >= 240);
  assert.ok(levo.minute <= 450);
  assert.deepEqual(iron.dose, user.dose);
  assert.equal(iron.source, "user");
  assert.equal(result.interactions[0].ruleId, "levothyroxine--ferrous-sulfate");
  assert.equal(JSON.stringify(request), snapshot);
});

test("UI catalogue products use demo ingredients without claiming a SNOMED mapping", () => {
  const record = { ...medicine("levo"), productId: "levothyroxine-50mcg-tablet" };
  const user = { ...medicine("iron", "39107411000001105"), source: "user" as const };
  const result = createSchedule({ routine, medicines: [record, user] });
  const schedule = doses(result);
  assert.equal(result.interactions[0].ruleId, "levothyroxine--ferrous-sulfate");
  assert.match(schedule.find((dose) => dose.medicineId === "levo")!.name, /50 micrograms/);
});

test("existing UI metformin doses use meal times", () => {
  const result = createSchedule({
    routine,
    medicines: [
      {
        ...medicine("metformin"),
        productId: "metformin-500mg-tablet",
        regimen: { kind: "daily", dosesPerDay: 2 },
      },
    ],
  });
  const schedule = doses(result);
  assert.equal(schedule.length, 2);
  assert.ok(schedule.every((dose) => ["08:00", "13:00", "18:30"].includes(dose.time)));
});

test("known review interactions block even when one medicine was entered by the user or is PRN", () => {
  const user: ScheduleMedicine = {
    ...medicine("naproxen", "1217387008"),
    source: "user",
    regimen: { kind: "as_needed" },
  };
  const result = createSchedule({
    routine,
    medicines: [medicine("warfarin", "42217911000001105"), user],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.schedule, null);
  assert.ok(
    result.warnings.some(
      (w) => w.code === "interaction_review" && w.blocking && w.action === "medication_review",
    ),
  );
});

test("unknown medicines receive provisional times and explicit coverage warnings", () => {
  const result = createSchedule({ routine, medicines: [medicine("unknown")] });
  assert.equal(doses(result).length, 1);
  assert.ok(result.warnings.some((w) => w.code === "unknown_product"));
  assert.ok(result.warnings.some((w) => w.code === "administration_not_defined"));
  assert.equal(result.demoOnly, true);
  assert.equal(result.clinicallyValidated, false);
});

test("the server does not fuzzy-match a familiar medicine name without a known code", () => {
  const result = createSchedule({
    routine,
    medicines: [{ ...medicine("unknown"), name: "Warfarin" }, medicine("naproxen", "1217387008")],
  });
  assert.equal(result.interactions.length, 0);
  assert.ok(
    result.warnings.some((w) => w.code === "unknown_product" && w.medicineIds.includes("unknown")),
  );
});

test("PRN medicines have no fixed doses and conditional separation guidance remains visible", () => {
  const prn: ScheduleMedicine = {
    ...medicine("iron", "39107411000001105"),
    regimen: { kind: "as_needed" },
  };
  const result = createSchedule({
    routine,
    medicines: [medicine("levo", "39698911000001100"), prn],
  });
  assert.equal(doses(result).length, 1);
  assert.equal(result.schedule!.asNeeded[0].id, "iron");
  assert.ok(
    result.warnings.some((w) => w.code === "conditional_spacing" && w.message.includes("240")),
  );
});

test("no meals makes an obligatory with-food plan impossible without dropping medicine doses", () => {
  const result = createSchedule({
    routine: { ...routine, meals: { breakfast: null, lunch: null, dinner: null } },
    medicines: [
      {
        ...medicine("metformin"),
        productId: "metformin-500mg-tablet",
        regimen: { kind: "daily", dosesPerDay: 2 },
      },
    ],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.schedule, null);
  assert.ok(result.warnings.some((w) => w.code === "unsatisfiable_constraints"));
});

test("client food:any cannot override a known before-food requirement", () => {
  const result = createSchedule({
    routine,
    medicines: [{ ...medicine("levo", "39698911000001100"), administration: { food: "any" } }],
  });
  assert.ok(doses(result)[0].minute <= 450);
  const conflict = createSchedule({
    routine,
    medicines: [
      { ...medicine("levo", "39698911000001100"), administration: { food: "with-food" } },
    ],
  });
  assert.equal(conflict.status, "blocked");
});

test("fixed times outside the waking day or breaking next-day gaps cannot be silently moved", () => {
  const outside: ScheduleMedicine = {
    ...medicine("outside"),
    regimen: { kind: "daily", dosesPerDay: 1, fixedTimes: ["06:00"] },
  };
  assert.equal(createSchedule({ routine, medicines: [outside] }).status, "blocked");
  const repeated: ScheduleMedicine = {
    ...medicine("twice"),
    regimen: {
      kind: "daily",
      dosesPerDay: 2,
      fixedTimes: ["07:00", "22:00"],
      minimumGapMinutes: 600,
    },
  };
  assert.equal(createSchedule({ routine, medicines: [repeated] }).status, "blocked");
});

test("overnight routines preserve clock time and following-day offsets", () => {
  const result = createSchedule({
    routine: {
      wake: "10:00",
      sleep: "02:00",
      meals: { breakfast: "10:30", lunch: "15:00", dinner: "21:00" },
    },
    medicines: [
      {
        ...medicine("overnight"),
        regimen: { kind: "daily", dosesPerDay: 1, fixedTimes: ["01:15"] },
      },
    ],
  });
  const dose = doses(result)[0];
  assert.equal(dose.time, "01:15");
  assert.equal(dose.dayOffset, 1);
  assert.equal(dose.minute, 1515);
});

test("duplicate ingredients and competing take-first rules require review", () => {
  const duplicate = createSchedule({
    routine,
    medicines: [medicine("a", "42382111000001102"), medicine("b", "42381911000001105")],
  });
  assert.equal(duplicate.status, "blocked");
  assert.ok(duplicate.warnings.some((w) => w.code === "duplicate_ingredient"));
  const cycle = createSchedule({
    routine,
    medicines: [medicine("levo", "39698911000001100"), medicine("alendronic", "39728011000001102")],
  });
  assert.equal(cycle.status, "blocked");
  assert.ok(cycle.warnings.some((w) => w.code === "unsatisfiable_constraints"));
});

test("interval regimens are explicitly unsupported; unconfirmed text is not interpreted", () => {
  const interval: ScheduleMedicine = {
    ...medicine("patch"),
    regimen: {
      kind: "interval",
      every: { value: 3, unit: "d" },
      anchor: "2026-10-24T08:00:00+01:00",
    },
  };
  const result = createSchedule({ routine, medicines: [interval] });
  assert.equal(result.status, "blocked");
  assert.ok(result.warnings.some((w) => w.code === "unsupported_interval_regimen"));
  const text = createSchedule({
    routine,
    medicines: [{ ...medicine("text"), instructions: "Before breakfast" }],
  });
  assert.equal(text.status, "blocked");
  assert.ok(text.warnings.some((w) => w.code === "unconfirmed_instructions"));
});

test("empty lists and all-PRN requests return valid empty timetables", () => {
  assert.deepEqual(doses(createSchedule({ routine, medicines: [] })), []);
  const result = createSchedule({
    routine,
    medicines: [{ ...medicine("prn"), regimen: { kind: "as_needed" } }],
  });
  assert.deepEqual(doses(result), []);
  assert.equal(result.schedule!.asNeeded.length, 1);
});

test("posture and water advice is returned and an unmet evening preference is visible", () => {
  const result = createSchedule({
    routine,
    medicines: [medicine("alendronic", "39728011000001102")],
  });
  const dose = doses(result)[0];
  assert.equal(dose.time, routine.wake);
  assert.ok(
    dose.instructions.some((text) => text.includes("tap water") && text.includes("30 minutes")),
  );
  const morningStatin = createSchedule({
    routine,
    medicines: [
      {
        ...medicine("simva", "42382111000001102"),
        regimen: { kind: "daily", dosesPerDay: 1, fixedTimes: ["08:00"] },
      },
    ],
  });
  assert.equal(doses(morningStatin)[0].time, "08:00");
  assert.ok(
    morningStatin.warnings.some((w) => w.code === "evening_preference_unmet" && !w.blocking),
  );
});

test("a before-meal timing code without a specified gap cannot silently invent an interval", () => {
  const result = createSchedule({
    routine,
    medicines: [
      { ...medicine("manual"), regimen: { kind: "daily", dosesPerDay: 1, when: ["ACM"] } },
    ],
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.warnings.some((w) => w.code === "before_meal_gap_unconfirmed"));
});

test("request validation rejects invalid shapes, duplicate IDs and malformed or conflicting routine times", () => {
  const good: ScheduleRequest = { routine, medicines: [medicine("a")] };
  assert.equal(validateScheduleRequest(good).valid, true);
  for (const value of [
    null,
    [],
    {},
    { ...good, extra: true },
    { ...good, medicines: [medicine("a"), medicine("a")] },
    { ...good, medicines: [{ ...medicine("a"), source: "other" }] },
    { ...good, medicines: [{ ...medicine("a"), dose: { quantity: 0, unit: "tablet" } }] },
    {
      ...good,
      medicines: [{ ...medicine("a"), dose: { quantity: 2, quantityMax: 1, unit: "tablet" } }],
    },
    { ...good, medicines: [{ ...medicine("a"), regimen: { kind: "daily", dosesPerDay: 0 } }] },
    {
      ...good,
      medicines: [
        { ...medicine("a"), regimen: { kind: "daily", dosesPerDay: 2, fixedTimes: ["08:00"] } },
      ],
    },
    { ...good, medicines: [{ ...medicine("a"), code: "123" }] },
    {
      ...good,
      medicines: [
        { ...medicine("a", "39698911000001100"), productId: "levothyroxine-50mcg-tablet" },
      ],
    },
    { ...good, medicines: [{ ...medicine("a"), administration: { food: "empty-stomach" } }] },
    { ...good, routine: { ...routine, wake: "25:00" } },
    { ...good, routine: { ...routine, sleep: routine.wake } },
    { ...good, routine: { ...routine, meals: { ...routine.meals, lunch: "23:00" } } },
    { ...good, routine: { ...routine, meals: { ...routine.meals, lunch: "07:30" } } },
  ]) {
    const result = validateScheduleRequest(value);
    assert.equal(result.valid, false, JSON.stringify(value));
    if (!result.valid) assert.ok(result.error.errors.length);
  }
});
