import type { ScheduleRequest, ScheduleValidationError } from "@hackathon/api-contract";
import { checkRoutine } from "@hackathon/medicines";

export const MAX_SCHEDULE_BODY_BYTES = 128 * 1024;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const whenCodes = ["ACM", "ACD", "ACV", "C", "CM", "CD", "CV", "MORN", "EVE", "HS", "WAKE"];
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function validateScheduleRequest(
  value: unknown,
): { valid: true; value: ScheduleRequest } | { valid: false; error: ScheduleValidationError } {
  const errors: ScheduleValidationError["errors"] = [];
  const fail = (path: string, message: string) => {
    errors.push({ path, message });
  };
  function fields(
    input: unknown,
    path: string,
    allowed: string[],
  ): input is Record<string, unknown> {
    if (!isObject(input)) {
      fail(path, "Must be an object");
      return false;
    }
    for (const key of Object.keys(input))
      if (!allowed.includes(key)) fail(`${path}.${key}`, "Unsupported field");
    return true;
  }
  function text(input: unknown, path: string, maximum = 500) {
    if (typeof input !== "string" || !input.trim() || input.length > maximum)
      fail(path, `Must be a non-empty string of at most ${maximum} characters`);
  }
  function number(input: unknown, path: string, minimum: number, maximum: number, integer = false) {
    if (
      typeof input !== "number" ||
      !Number.isFinite(input) ||
      input < minimum ||
      input > maximum ||
      (integer && !Number.isInteger(input))
    )
      fail(path, `Must be ${integer ? "an integer" : "a number"} from ${minimum} to ${maximum}`);
  }
  function time(input: unknown, path: string) {
    if (typeof input !== "string" || !timePattern.test(input))
      fail(path, "Must be a 24-hour HH:MM time");
  }
  if (fields(value, "$", ["routine", "medicines"])) {
    if (fields(value.routine, "$.routine", ["wake", "sleep", "meals"])) {
      time(value.routine.wake, "$.routine.wake");
      time(value.routine.sleep, "$.routine.sleep");
      if (fields(value.routine.meals, "$.routine.meals", ["breakfast", "lunch", "dinner"])) {
        for (const meal of ["breakfast", "lunch", "dinner"])
          if (value.routine.meals[meal] !== null)
            time(value.routine.meals[meal], `$.routine.meals.${meal}`);
      }
      if (!errors.length)
        for (const issue of checkRoutine(value.routine as unknown as ScheduleRequest["routine"]))
          fail("$.routine", issue.code);
    }
    if (!Array.isArray(value.medicines) || value.medicines.length > 40)
      fail("$.medicines", "Must be an array of at most 40 medicines");
    else {
      const ids = new Set<unknown>();
      let totalDoses = 0;
      value.medicines.forEach((medicine, index) => {
        const path = `$.medicines[${index}]`;
        if (
          !fields(medicine, path, [
            "id",
            "source",
            "name",
            "code",
            "system",
            "productId",
            "dose",
            "regimen",
            "administration",
            "instructions",
            "instructionsConfirmed",
          ])
        )
          return;
        text(medicine.id, `${path}.id`, 100);
        if (ids.has(medicine.id))
          fail(`${path}.id`, "Medicine IDs must be unique across record and user medicines");
        ids.add(medicine.id);
        text(medicine.name, `${path}.name`);
        if (!["record", "user"].includes(medicine.source as string))
          fail(`${path}.source`, "Must be record or user");
        for (const field of ["code", "system", "productId"])
          if (medicine[field] !== undefined) text(medicine[field], `${path}.${field}`, 300);
        if ((medicine.code === undefined) !== (medicine.system === undefined))
          fail(path, "Supply both code and system, or neither");
        if (medicine.code !== undefined && medicine.productId !== undefined)
          fail(
            path,
            "Use a coded product or a local productId; there is no verified mapping between these catalogues",
          );
        if (medicine.instructions !== undefined)
          text(medicine.instructions, `${path}.instructions`, 2000);
        if (
          medicine.instructionsConfirmed !== undefined &&
          typeof medicine.instructionsConfirmed !== "boolean"
        )
          fail(`${path}.instructionsConfirmed`, "Must be a boolean");
        if (fields(medicine.dose, `${path}.dose`, ["quantity", "quantityMax", "unit"])) {
          number(medicine.dose.quantity, `${path}.dose.quantity`, 0.000001, 1_000_000);
          text(medicine.dose.unit, `${path}.dose.unit`, 50);
          if (medicine.dose.quantityMax !== undefined) {
            number(medicine.dose.quantityMax, `${path}.dose.quantityMax`, 0.000001, 1_000_000);
            if (
              typeof medicine.dose.quantity === "number" &&
              typeof medicine.dose.quantityMax === "number" &&
              medicine.dose.quantityMax < medicine.dose.quantity
            )
              fail(`${path}.dose.quantityMax`, "Must not be less than quantity");
          }
        }
        const regimen = medicine.regimen;
        if (isObject(regimen) && regimen.kind === "daily") {
          fields(regimen, `${path}.regimen`, [
            "kind",
            "dosesPerDay",
            "fixedTimes",
            "minimumGapMinutes",
            "when",
          ]);
          number(regimen.dosesPerDay, `${path}.regimen.dosesPerDay`, 1, 8, true);
          if (typeof regimen.dosesPerDay === "number") totalDoses += regimen.dosesPerDay;
          if (regimen.minimumGapMinutes !== undefined)
            number(regimen.minimumGapMinutes, `${path}.regimen.minimumGapMinutes`, 0, 1440, true);
          if (regimen.fixedTimes !== undefined) {
            if (
              !Array.isArray(regimen.fixedTimes) ||
              regimen.fixedTimes.length !== regimen.dosesPerDay
            )
              fail(`${path}.regimen.fixedTimes`, "Provide exactly one fixed time per daily dose");
            else {
              regimen.fixedTimes.forEach((entry, i) =>
                time(entry, `${path}.regimen.fixedTimes[${i}]`),
              );
              if (new Set(regimen.fixedTimes).size !== regimen.fixedTimes.length)
                fail(`${path}.regimen.fixedTimes`, "Times must be distinct");
            }
          }
          if (
            regimen.when !== undefined &&
            (!Array.isArray(regimen.when) ||
              regimen.when.length > 11 ||
              regimen.when.some((code) => !whenCodes.includes(code as string)))
          )
            fail(`${path}.regimen.when`, "Contains an unsupported FHIR timing code");
        } else if (isObject(regimen) && regimen.kind === "as_needed")
          fields(regimen, `${path}.regimen`, ["kind"]);
        else if (isObject(regimen) && regimen.kind === "interval") {
          fields(regimen, `${path}.regimen`, ["kind", "every", "anchor"]);
          if (fields(regimen.every, `${path}.regimen.every`, ["value", "unit"])) {
            number(regimen.every.value, `${path}.regimen.every.value`, 0.000001, 10000);
            if (!["h", "d", "wk"].includes(regimen.every.unit as string))
              fail(`${path}.regimen.every.unit`, "Must be h, d or wk");
          }
          if (regimen.anchor !== undefined) text(regimen.anchor, `${path}.regimen.anchor`, 100);
        } else fail(`${path}.regimen`, "Must have kind daily, as_needed or interval");
        if (
          medicine.administration !== undefined &&
          fields(medicine.administration, `${path}.administration`, ["food", "emptyStomach"])
        ) {
          if (
            medicine.administration.food !== undefined &&
            !["any", "with-food", "empty-stomach"].includes(medicine.administration.food as string)
          )
            fail(`${path}.administration.food`, "Unsupported food relationship");
          if (
            medicine.administration.emptyStomach !== undefined &&
            fields(medicine.administration.emptyStomach, `${path}.administration.emptyStomach`, [
              "beforeMinutes",
              "afterMinutes",
            ])
          ) {
            number(
              medicine.administration.emptyStomach.beforeMinutes,
              `${path}.administration.emptyStomach.beforeMinutes`,
              0,
              1440,
              true,
            );
            number(
              medicine.administration.emptyStomach.afterMinutes,
              `${path}.administration.emptyStomach.afterMinutes`,
              0,
              1440,
              true,
            );
            if (medicine.administration.food !== "empty-stomach")
              fail(`${path}.administration`, "emptyStomach requires food: empty-stomach");
          }
          if (
            medicine.administration.food === "empty-stomach" &&
            !medicine.administration.emptyStomach
          )
            fail(
              `${path}.administration.emptyStomach`,
              "Provide both fasting gaps; no values are assumed",
            );
        }
      });
      if (totalDoses > 120)
        fail("$.medicines", "At most 120 regular daily doses are supported per request");
    }
  }
  return errors.length
    ? { valid: false, error: { message: "Invalid schedule request", errors } }
    : { valid: true, value: value as ScheduleRequest };
}
