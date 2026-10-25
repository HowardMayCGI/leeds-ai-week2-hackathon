import type {
  AdministrationDataset,
  Medication,
  ScheduleMedicine,
  ScheduleRequest,
  ScheduleResponse,
  ScheduleWarning,
} from "@hackathon/api-contract";
import {
  ADMINISTRATION_RULES,
  RULES_VERSION,
  formatClockTime,
  parseClockTime,
  planDaily,
  toDay,
  verifyDailyPlan,
  type DailyConstraint,
  type DailyRelation,
} from "@hackathon/medicines";
import {
  CATALOGUE_VERSION,
  findProduct,
  formatStrength,
  ingredientCodes,
} from "./legacy-catalogue";
import { checkInteractions, interactionDataset } from "./interactions";
import { administrationDataset } from "./schedule-inputs";

export const SCHEDULER_VERSION = "daily-api-2026-10-24-v1";
type Rule = AdministrationDataset["rules"][number];
interface Resolved {
  input: ScheduleMedicine;
  name: string;
  ingredients: string[];
  route?: string;
  matched: boolean;
  local: boolean;
  rules: Rule[];
}

function resolve(input: ScheduleMedicine): Resolved {
  const product = interactionDataset.products.find(
    (p) => p.code === input.code && p.system === input.system,
  );
  const local = input.productId ? findProduct(input.productId) : undefined;
  const ingredients = product?.ingredientIds ?? (local ? ingredientCodes(local) : []);
  const rules = administrationDataset.rules.filter((rule) =>
    product
      ? rule.system === product.system && rule.productCodes.includes(product.code)
      : // Deliberate local demo rules, not an asserted mapping to a different strength's SNOMED code.
        local &&
        ((ingredients.includes("levothyroxine") && rule.id === "levothyroxine-before-food") ||
          (ingredients.includes("simvastatin") && rule.id === "simvastatin-evening")),
  );
  return {
    input,
    name: product?.name ?? (local ? `${local.name} ${formatStrength(local)}`.trim() : input.name),
    ingredients,
    route: product?.route ?? (local ? "oral" : undefined),
    matched: Boolean(product || local),
    local: Boolean(local),
    rules,
  };
}

/** All medicines are submitted selections. This never reads or writes a patient's clinical record. */
export function createSchedule(request: ScheduleRequest): ScheduleResponse {
  const day = toDay(request.routine);
  const resolved = request.medicines
    .map(resolve)
    .sort((a, b) => a.input.id.localeCompare(b.input.id));
  const byId = new Map(resolved.map((item) => [item.input.id, item]));
  const warnings: ScheduleWarning[] = [];
  const warn = (
    code: string,
    ids: string[],
    message: string,
    blocking = false,
    action: ScheduleWarning["action"] = "information",
  ) => {
    warnings.push({
      code,
      medicineIds: ids,
      message,
      blocking,
      action,
      severity: blocking ? "error" : action === "information" ? "info" : "warning",
    });
  };
  warn(
    "limited_demo_data",
    [],
    "Demonstration proposal only, not for clinical use. Medicine knowledge is incomplete; no interaction match does not establish safety. Confirm prescriptions, quantities and instructions before using a plan.",
    false,
    "confirm_instructions",
  );
  const medications: Medication[] = resolved.map(({ input, name }) => ({
    id: input.id,
    name,
    code: input.code,
    system: input.system,
    dose: { value: input.dose.quantity, unit: input.dose.unit },
    asNeeded: input.regimen.kind === "as_needed",
    instructions: input.instructions ? [input.instructions] : [],
  }));
  const assessment = checkInteractions({ nhsNumber: "", medications }, (medicine) => {
    const item = byId.get(medicine.id)!;
    return item.matched ? { ingredientIds: item.ingredients } : undefined;
  });
  for (const interaction of assessment.interactions) {
    if (interaction.management.action !== "separate_doses")
      warn(
        "interaction_review",
        interaction.medications.map((m) => m.id),
        interaction.patientGuidance,
        true,
        "medication_review",
      );
  }
  const constraints: DailyConstraint[] = [];
  const relations: DailyRelation[] = [];
  const instructions = new Map<string, string[]>();
  const meals = Object.values(day.meals).filter((minute): minute is number => minute !== undefined);
  const events = [day.wake, ...meals, day.sleep];
  for (const item of resolved) {
    const { input } = item;
    const ids = [input.id];
    const legacyRules = item.local
      ? item.ingredients.map((id) => ADMINISTRATION_RULES[id]).filter(Boolean)
      : [];
    const guidance = [
      ...(input.instructions ? [input.instructions] : []),
      ...item.rules.flatMap((rule) => rule.instructions),
    ];
    if (legacyRules.some((rule) => rule.food === "with-food"))
      guidance.push("Demo administration rule: take with food.");
    instructions.set(input.id, guidance);
    if (!item.matched)
      warn(
        "unknown_product",
        ids,
        "This item was not matched by a coded product or local catalogue ID. Timing can be proposed, but its ingredients and interactions have not been checked.",
        false,
        "confirm_instructions",
      );
    if (!item.rules.length && !legacyRules.length)
      warn(
        "administration_not_defined",
        ids,
        "No product administration rule is defined in this demo. Confirm food, timing and special instructions; absence of a rule does not mean unrestricted use.",
        false,
        "confirm_instructions",
      );
    if (input.instructions && !input.instructionsConfirmed)
      warn(
        "unconfirmed_instructions",
        ids,
        "Confirm the original instruction text and encode its timing requirements. Free text is displayed but is not automatically interpreted.",
        true,
        "confirm_instructions",
      );
    if (guidance.length) warn("administration_guidance", ids, guidance.join(" "));
    if (input.dose.quantityMax !== undefined)
      warn(
        "dose_range",
        ids,
        "The dose range is preserved. This service does not decide which quantity within the prescribed range to take.",
        false,
        "confirm_instructions",
      );
    if (input.regimen.kind === "interval") {
      warn(
        "unsupported_interval_regimen",
        ids,
        "This repeating-day service cannot schedule hourly, every-N-days or weekly courses from an anchor. Confirm a calendar-based plan with a pharmacist; this medicine has not been converted into a daily dose.",
        true,
        "medication_review",
      );
      continue;
    }
    if (input.regimen.kind === "as_needed") {
      warn(
        "prn_not_scheduled",
        ids,
        "Take only when needed as instructed. No regular dose times are generated. Confirm minimum intervals and maximum doses.",
        false,
        "confirm_instructions",
      );
      continue;
    }
    const regimen = input.regimen;
    if (regimen.dosesPerDay > 1 && regimen.minimumGapMinutes === undefined)
      warn(
        "dose_interval_unconfirmed",
        ids,
        "Dose times are spread through the waking day. No minimum between doses was supplied; confirm any prescribed interval.",
        false,
        "confirm_instructions",
      );
    let allowed = Array.from(
      { length: day.sleep - day.wake + 1 },
      (_, offset) => day.wake + offset,
    );
    let preferred = [...events];
    const withFood = () => {
      allowed = allowed.filter((minute) => meals.includes(minute));
    };
    const fasting = (before: number, after: number) => {
      allowed = allowed.filter((minute) =>
        meals.every((meal) =>
          [-1440, 0, 1440].every(
            (shift) => minute <= meal + shift - before || minute >= meal + shift + after,
          ),
        ),
      );
    };
    // Apply both submitted and server rules; a client cannot turn off a known requirement.
    if (input.administration?.food === "with-food") withFood();
    if (input.administration?.food === "empty-stomach")
      fasting(
        input.administration.emptyStomach!.beforeMinutes,
        input.administration.emptyStomach!.afterMinutes,
      );
    for (const rule of legacyRules) {
      if (rule.food === "with-food") withFood();
      if (rule.food === "empty-stomach")
        fasting(rule.emptyStomach!.beforeMinutes, rule.emptyStomach!.afterMinutes);
    }
    for (const rule of item.rules)
      for (const constraint of rule.constraints) {
        if (constraint.type === "food" && constraint.relationship === "with_food") {
          if (constraint.strength === "requirement") withFood();
          else preferred = meals.length ? [...meals] : preferred;
        }
        if (constraint.type === "food" && constraint.relationship === "before_first_food") {
          if (!meals.length)
            warn(
              "first_meal_required",
              ids,
              "Provide the first meal time to apply the before-food instruction.",
              true,
              "change_routine",
            );
          else
            allowed = allowed.filter(
              (minute) => minute <= Math.min(...meals) - (constraint.minimumGapMinutes ?? 0),
            );
        }
        if (constraint.type === "time_of_day" && constraint.value === "on_waking")
          allowed = allowed.filter((minute) => minute === day.wake);
        if (constraint.type === "time_of_day" && constraint.value === "evening") {
          const evening = events.filter((minute) => minute >= day.sleep - 360);
          if (constraint.strength === "requirement")
            allowed = allowed.filter((minute) => minute >= day.sleep - 360);
          preferred = evening;
        }
        if (constraint.type === "remain_upright")
          allowed = allowed.filter((minute) => minute <= day.sleep - constraint.durationMinutes);
      }
    const when = regimen.when ?? [];
    if (when.includes("C")) withFood();
    const namedMeals = {
      ACM: "breakfast",
      ACD: "lunch",
      ACV: "dinner",
      CM: "breakfast",
      CD: "lunch",
      CV: "dinner",
    } as const;
    const withMeals: number[] = [],
      beforeMeals: number[] = [];
    for (const code of when) {
      if (code === "MORN") allowed = allowed.filter((minute) => minute <= day.wake + 240);
      if (code === "EVE") allowed = allowed.filter((minute) => minute >= day.sleep - 360);
      if (code === "HS") allowed = allowed.filter((minute) => minute >= day.sleep - 60);
      if (code === "WAKE") allowed = allowed.filter((minute) => minute === day.wake);
      if (code in namedMeals) {
        const meal = namedMeals[code as keyof typeof namedMeals];
        const minute = day.meals[meal];
        if (minute === undefined)
          warn(
            "required_meal_skipped",
            ids,
            `The prescribed ${meal} timing cannot be applied because that meal is skipped.`,
            true,
            "change_routine",
          );
        else (code.startsWith("AC") ? beforeMeals : withMeals).push(minute);
      }
    }
    if (withMeals.length) allowed = allowed.filter((minute) => withMeals.includes(minute));
    if (beforeMeals.length) {
      const beforeGap =
        input.administration?.emptyStomach?.beforeMinutes ??
        legacyRules.find((rule) => rule.emptyStomach)?.emptyStomach?.beforeMinutes ??
        item.rules
          .flatMap((rule) =>
            rule.constraints.flatMap((c) =>
              c.type === "food" && c.relationship === "before_first_food"
                ? [c.minimumGapMinutes]
                : [],
            ),
          )
          .find((gap) => gap !== undefined);
      if (beforeGap === undefined)
        warn(
          "before_meal_gap_unconfirmed",
          ids,
          "Confirm how many minutes before the meal this dose should be taken; no generic gap is assumed.",
          true,
          "confirm_instructions",
        );
      else {
        allowed = allowed.filter((minute) =>
          beforeMeals.some((meal) => minute <= meal - beforeGap),
        );
        preferred = beforeMeals.map((meal) => meal - beforeGap);
      }
    }
    if (regimen.fixedTimes) {
      const fixed = regimen.fixedTimes.map((time) => {
        const minute = parseClockTime(time)!;
        return minute < day.wake ? minute + 1440 : minute;
      });
      allowed = allowed.filter((minute) => fixed.includes(minute));
    }
    constraints.push({
      id: input.id,
      doses: regimen.dosesPerDay,
      allowedMinutes: allowed,
      preferredMinutes: preferred,
      minimumGapMinutes: regimen.minimumGapMinutes ?? 0,
    });
  }
  for (let i = 0; i < resolved.length; i++)
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i],
        b = resolved[j];
      const overlap = a.ingredients.filter((id) => b.ingredients.includes(id));
      if (overlap.length)
        warn(
          "duplicate_ingredient",
          [a.input.id, b.input.id],
          `These items contain the same ingredient (${overlap.join(", ")}). Confirm that both products and the combined dose are intended.`,
          true,
          "medication_review",
        );
    }
  const timed = new Set(constraints.map((c) => c.id));
  const addRelation = (
    from: string,
    to: string,
    minimumGapMinutes: number,
    direction: DailyRelation["direction"],
  ) => {
    if (timed.has(from) && timed.has(to))
      relations.push({ from, to, minimumGapMinutes, direction });
    else
      warn(
        "conditional_spacing",
        [from, to],
        `If both medicines are taken, leave at least ${minimumGapMinutes} minutes between doses${direction === "before" ? `, taking ${from} first` : ""}. An as-needed dose has no fixed time in this proposal.`,
        false,
        "confirm_instructions",
      );
  };
  for (const constraint of assessment.scheduling.constraints)
    addRelation(...constraint.medicationIds, constraint.minimumGapMinutes, "either_order");
  for (const item of resolved) {
    for (const rule of item.rules)
      for (const constraint of rule.constraints) {
        if (constraint.type === "before_other_oral_medicines")
          for (const other of resolved) {
            if (other.input.id !== item.input.id && other.route === "oral")
              addRelation(item.input.id, other.input.id, constraint.minimumGapMinutes, "before");
          }
      }
    if (item.local)
      for (const id of item.ingredients)
        for (const gap of ADMINISTRATION_RULES[id]?.separateFrom ?? [])
          for (const other of resolved) {
            if (
              other.input.id !== item.input.id &&
              other.ingredients.some((ingredient) => gap.ingredients.includes(ingredient))
            )
              addRelation(item.input.id, other.input.id, gap.hours * 60, "either_order");
          }
  }
  const usedSourceIds = new Set(
    resolved.flatMap((item) => item.rules.flatMap((rule) => rule.sourceIds)),
  );
  const base = {
    demoOnly: true as const,
    clinicallyValidated: false as const,
    versions: {
      scheduler: SCHEDULER_VERSION,
      administration: `${administrationDataset.version}+${RULES_VERSION}`,
      interactions: interactionDataset.version,
      catalogue: CATALOGUE_VERSION,
    },
    warnings,
    interactions: assessment.interactions,
    sources: [
      ...administrationDataset.sources.filter((source) => usedSourceIds.has(source.id)),
      ...assessment.sources,
    ],
  };
  if (warnings.some((warning) => warning.blocking))
    return { ...base, status: "blocked", schedule: null };
  const result = planDaily(constraints, relations);
  if (result.status !== "ok") {
    warn(
      result.status === "search_limit" ? "search_limit" : "unsatisfiable_constraints",
      constraints.map((c) => c.id),
      result.status === "search_limit"
        ? "The planning search reached its limit. No schedule is returned; this does not prove the requirements are impossible."
        : "The supplied times and requirements cannot all be met, including gaps across successive days. Review the routine or instructions; no rule has been relaxed.",
      true,
      "change_routine",
    );
    return { ...base, status: "blocked", schedule: null };
  }
  if (!verifyDailyPlan(constraints, relations, result.times)) {
    warn(
      "verification_failed",
      constraints.map((c) => c.id),
      "The proposal failed independent verification and has been withheld.",
      true,
      "medication_review",
    );
    return { ...base, status: "blocked", schedule: null };
  }
  for (const item of resolved)
    for (const rule of item.rules)
      for (const constraint of rule.constraints) {
        if (constraint.strength !== "preference" || !result.times[item.input.id]) continue;
        const times = result.times[item.input.id];
        if (
          constraint.type === "food" &&
          constraint.relationship === "with_food" &&
          times.some((minute) => !meals.includes(minute))
        ) {
          warn(
            "food_preference_unmet",
            [item.input.id],
            "The proposed times do not all coincide with meals. Confirm how to follow the recommendation to take this medicine with or after food.",
            false,
            "confirm_instructions",
          );
        }
        if (
          constraint.type === "time_of_day" &&
          constraint.value === "evening" &&
          times.some((minute) => minute < day.sleep - 360)
        ) {
          warn(
            "evening_preference_unmet",
            [item.input.id],
            "The evening preference was not met. Confirm the prescribed timing before using this proposal.",
            false,
            "confirm_instructions",
          );
        }
      }
  return {
    ...base,
    status: "proposed",
    schedule: {
      routine: request.routine,
      doses: resolved
        .flatMap((item) =>
          (result.times[item.input.id] ?? []).map((minute) => ({
            medicineId: item.input.id,
            name: item.name,
            source: item.input.source,
            dose: item.input.dose,
            time: formatClockTime(minute),
            dayOffset: Math.floor(minute / 1440),
            minute,
            instructions: instructions.get(item.input.id) ?? [],
          })),
        )
        .sort((a, b) => a.minute - b.minute || a.medicineId.localeCompare(b.medicineId)),
      asNeeded: resolved
        .filter((item) => item.input.regimen.kind === "as_needed")
        .map((item) => ({ ...item.input, name: item.name })),
    },
  };
}
