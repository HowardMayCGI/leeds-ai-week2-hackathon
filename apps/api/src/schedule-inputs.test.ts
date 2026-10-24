import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { administrationDataset, buildScheduleInputs } from "./schedule-inputs";
import { interactionDataset } from "./interactions";
import { createFilePatientRepository, toMedication } from "./patient-data";

function medicine(
  code = "39698911000001100",
  dosage: Record<string, unknown> = {
    asNeededBoolean: false,
    doseQuantity: { value: 1, unit: "tablet" },
    timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } },
  },
) {
  const product = interactionDataset.products.find((product) => product.code === code)!;
  return toMedication({
    id: `rx-${code}`,
    medicationCodeableConcept: { text: product.name, coding: [{ code, system: product.system }] },
    dosageInstruction: [dosage],
  });
}
const check = (...medications: ReturnType<typeof medicine>[]) =>
  buildScheduleInputs({ nhsNumber: "9993679666", medications });

test("administration rules reference exact known products and sources", () => {
  assert.equal(administrationDataset.demoOnly, true);
  assert.equal(
    new Set(administrationDataset.rules.map((rule) => rule.id)).size,
    administrationDataset.rules.length,
  );
  for (const rule of administrationDataset.rules) {
    assert.ok(
      rule.productCodes.every((code) =>
        interactionDataset.products.some(
          (product) => product.code === code && product.system === rule.system,
        ),
      ),
    );
    assert.ok(
      rule.sourceIds.length &&
        rule.sourceIds.every((id) =>
          administrationDataset.sources.some((source) => source.id === id),
        ),
    );
  }
});

test("returns prescribed dose and frequency without deriving them from product strength", () => {
  const result = check(medicine()).medicines[0];
  assert.deepEqual(result.medication.dose, { value: 1, unit: "tablet" });
  assert.equal(result.use, "regular");
  assert.deepEqual(result.prescriptionTiming.frequency, {
    frequency: 1,
    period: 1,
    periodUnit: "d",
  });
  assert.equal(
    result.prescriptionTiming.minimumDoseIntervalMinutes,
    undefined,
    "once daily does not imply a strict 24-hour interval",
  );
  assert.equal(result.issues.length, 0);
});

test("preserves text, patient instructions, dosage ranges and multiple steps for review", () => {
  const first = {
    text: "Taper as directed",
    patientInstruction: "See your label",
    doseAndRate: [{ doseRange: { low: { value: 1 }, high: { value: 2 } } }],
  };
  const med = toMedication({
    id: "taper",
    dosageInstruction: [first, { sequence: 2, text: "Second step" }],
  });
  const result = check(med);
  assert.deepEqual(result.medicines[0].medication.dosageInstructions, [
    first,
    { sequence: 2, text: "Second step" },
  ]);
  assert.ok(result.medicines[0].issues.some((issue) => issue.code === "dosage_steps_unresolved"));
  assert.ok(result.medicines[0].issues.some((issue) => issue.code === "unsupported_regimen"));
  assert.ok(
    result.medicines[0].issues.some(
      (issue) => issue.code === "instruction_text_requires_confirmation",
    ),
  );
  assert.equal(result.readiness.status, "review_required");
});

test("reports missing dose, unit, frequency and PRN status; never assumes a daily regimen", () => {
  const result = check(medicine("39698911000001100", {})).medicines[0];
  assert.equal(result.use, "unconfirmed");
  assert.equal(result.prescriptionTiming.frequency, undefined);
  assert.ok(result.issues.some((issue) => issue.code === "dose_missing_or_invalid"));
  assert.ok(result.issues.some((issue) => issue.code === "dose_unit_missing"));
  assert.ok(result.issues.some((issue) => issue.code === "frequency_missing_or_invalid"));
  assert.ok(result.issues.some((issue) => issue.code === "regular_or_prn_unconfirmed"));
  const missingPeriod = check(
    medicine("39698911000001100", { asNeededBoolean: false, timing: { repeat: { frequency: 1 } } }),
  ).medicines[0];
  assert.equal(missingPeriod.prescriptionTiming.frequency, undefined);
  assert.ok(missingPeriod.issues.some((issue) => issue.code === "frequency_missing_or_invalid"));
});

test("PRN medicines are identified separately and still checked for interactions", () => {
  const prn = medicine("1217387008", {
    asNeededBoolean: true,
    doseQuantity: { value: 1, unit: "tablet" },
  });
  const result = check(prn, medicine("42217911000001105"));
  assert.equal(result.medicines[0].use, "as_needed");
  assert.ok(result.medicines[0].issues.some((issue) => issue.code === "prn_limits_unconfirmed"));
  assert.ok(
    !result.medicines[0].issues.some((issue) => issue.code === "frequency_missing_or_invalid"),
  );
  assert.equal(result.interactions.interactions[0].ruleId, "warfarin--naproxen");
  assert.equal(result.readiness.status, "review_required");
});

test("returns meal, posture and water requirements and separates only other oral medicines", () => {
  const alendronic = medicine("39728011000001102");
  const oral = medicine("322236009");
  const inhaled = medicine("770300007");
  const result = check(alendronic, oral, inhaled);
  const constraints = result.medicines[0].administration.constraints;
  assert.ok(
    constraints.some(
      (c) =>
        c.type === "food" && c.relationship === "before_first_food" && c.minimumGapMinutes === 30,
    ),
  );
  assert.ok(constraints.some((c) => c.type === "remain_upright" && c.durationMinutes === 30));
  assert.ok(constraints.some((c) => c.type === "plain_water_only"));
  assert.deepEqual(
    result.administrationSeparations.map((c) => c.beforeMedicationId),
    [oral.id],
  );
  assert.equal(result.administrationSeparations[0].appliesAcrossMidnight, true);
  assert.equal(result.readiness.requiresSpecialInstructionAcknowledgement, true);
});

test("four-hour interaction spacing coexists with a shorter directional administration rule", () => {
  const result = check(medicine(), medicine("39107411000001105"));
  assert.equal(result.interactions.scheduling.constraints[0].minimumGapMinutes, 240);
  assert.equal(result.administrationSeparations[0].minimumGapMinutes, 30);
  assert.equal(result.administrationSeparations[0].medicationId, medicine().id);
  assert.equal(
    result.administrationSeparations[0].beforeMedicationId,
    medicine("39107411000001105").id,
  );
});

test("competing first-medicine requirements require professional review", () => {
  const result = check(medicine(), medicine("39728011000001102"));
  assert.equal(result.readiness.status, "review_required");
  assert.ok(
    result.medicines.every((medicine) =>
      medicine.issues.some((issue) => issue.code === "administration_order_conflict"),
    ),
  );
});

test("preserves non-daily intervals and requires an anchor rather than assuming a dose today", () => {
  const result = check(
    medicine("39698911000001100", {
      asNeededBoolean: false,
      timing: { repeat: { frequency: 1, period: 3, periodUnit: "d" } },
    }),
  ).medicines[0];
  assert.equal(result.prescriptionTiming.frequency?.period, 3);
  assert.equal(result.prescriptionTiming.requiresAnchor, true);
  assert.ok(result.issues.some((issue) => issue.code === "interval_anchor_required"));
});

test("extracts exact coded interval instructions but still requires text confirmation", () => {
  const result = check(
    medicine("39698911000001100", {
      additionalInstruction: [
        {
          coding: [
            { system: "http://snomed.info/sct", code: "307468000", display: "Every six hours" },
          ],
        },
      ],
      timing: { repeat: { frequency: 4, period: 1, periodUnit: "d" } },
    }),
  ).medicines[0];
  assert.equal(result.prescriptionTiming.minimumDoseIntervalMinutes, 360);
  assert.ok(result.issues.some((issue) => issue.code === "instruction_text_requires_confirmation"));
  const wrongSystem = check(
    medicine("39698911000001100", {
      additionalInstruction: [{ coding: [{ system: "urn:other", code: "307468000" }] }],
    }),
  ).medicines[0];
  assert.equal(wrongSystem.prescriptionTiming.minimumDoseIntervalMinutes, undefined);
});

test("fixed times, unsupported timing and contradictory intervals are explicit", () => {
  const fixed = check(
    medicine("39698911000001100", {
      timing: { repeat: { frequency: 1, period: 1, periodUnit: "d", timeOfDay: ["08:00:00"] } },
    }),
  ).medicines[0];
  assert.deepEqual(fixed.prescriptionTiming.timeOfDay, ["08:00:00"]);
  const invalid = check(
    medicine("39698911000001100", {
      timing: {
        repeat: {
          frequency: 2,
          period: 1,
          periodUnit: "d",
          timeOfDay: ["25:00"],
          when: ["UNKNOWN"],
        },
      },
    }),
  ).medicines[0];
  assert.ok(invalid.issues.some((issue) => issue.code === "unsupported_timing"));
  assert.ok(invalid.issues.some((issue) => issue.code === "conflicting_timing"));
  const conflict = check(
    medicine("39698911000001100", {
      timing: { repeat: { frequency: 5, period: 1, periodUnit: "d" } },
      additionalInstruction: [
        { coding: [{ system: "http://snomed.info/sct", code: "307468000" }] },
      ],
    }),
  ).medicines[0];
  assert.ok(
    conflict.issues.some(
      (issue) =>
        issue.code === "conflicting_interval" && issue.resolution === "professional_review",
    ),
  );
});

test("missing administration rules and mismatched coding systems never mean unrestricted", () => {
  const med = medicine();
  const result = check({ ...med, system: "urn:other" }, medicine("322236009"));
  assert.ok(
    result.medicines.every((medicine) => medicine.administration.coverage === "not_defined"),
  );
  assert.ok(
    result.medicines.every((medicine) =>
      medicine.issues.some((issue) => issue.code === "administration_not_defined"),
    ),
  );
  assert.equal(result.demoOnly, true);
  assert.equal(result.clinicallyValidated, false);
  assert.equal(result.readiness.requiresRoutine, true);
  assert.equal(result.readiness.requiresCurrentMedicineConfirmation, true);
});

test("existing patient records produce inputs without being changed", async () => {
  const patients = createFilePatientRepository(
    fileURLToPath(new URL("../../../test_data", import.meta.url)),
  );
  for (const patient of (await patients.listPatients()).patients) {
    const record = (await patients.getMedications(patient.nhsNumber))!;
    const before = JSON.stringify(record);
    const result = buildScheduleInputs(record);
    assert.equal(JSON.stringify(record), before);
    assert.equal(result.medicines.length, record.medications.length);
    assert.ok(result.medicines.every((medicine) => medicine.medication.dosageInstructions));
    assert.equal(result.nhsNumber, patient.nhsNumber);
  }
});
