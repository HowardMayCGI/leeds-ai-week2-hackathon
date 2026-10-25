import type {
  InteractionDataset,
  InteractionsResponse,
  Medication,
  MedicationsResponse,
  SelectedMedicine,
  SelectionInteractionsResponse,
} from "@hackathon/api-contract";
import data from "./data/demo-interactions.json";

export const interactionDataset = data as InteractionDataset;
const products = new Map(
  interactionDataset.products.map((product) => [`${product.system}|${product.code}`, product]),
);
const ruledIngredients = new Set(
  interactionDataset.interactions.flatMap((rule) => rule.ingredients),
);

/** Exact coded-product matching only. Includes PRN medicines because concurrent use is still possible. */
export function checkInteractions(
  record: MedicationsResponse,
  resolveProduct: (medicine: Medication) => { ingredientIds: string[] } | undefined = (medicine) =>
    products.get(`${medicine.system}|${medicine.code}`),
): InteractionsResponse {
  const medications = [...record.medications].sort((a, b) => a.id.localeCompare(b.id));
  const productOf = resolveProduct;
  const response: InteractionsResponse = {
    nhsNumber: record.nhsNumber,
    datasetVersion: interactionDataset.version,
    demoOnly: true,
    clinicallyValidated: false,
    assessment: "potential_interactions_from_record",
    coverage: "limited_demo_rules",
    notice:
      "Hackathon demonstration only; not for clinical use. Incomplete rules applied to active records, not confirmed concurrent use. No matches does not mean safe. Do not stop or change prescribed treatment without professional advice.",
    sources: [],
    interactions: [],
    uncheckedMedications: [],
    scheduling: { status: "no_rules_matched", reviewInteractionIds: [], constraints: [] },
  };
  for (const medication of medications) {
    const product = productOf(medication);
    if (!product || !product.ingredientIds.some((id) => ruledIngredients.has(id))) {
      response.uncheckedMedications.push({
        medication,
        reason: product ? "no_demo_rules" : "unmapped_product",
      });
    }
  }
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const a = medications[i],
        b = medications[j];
      const left = productOf(a)?.ingredientIds ?? [],
        right = productOf(b)?.ingredientIds ?? [];
      for (const rule of interactionDataset.interactions) {
        const [x, y] = rule.ingredients;
        if (!(left.includes(x) && right.includes(y)) && !(left.includes(y) && right.includes(x)))
          continue;
        const id = `${rule.id}:${encodeURIComponent(a.id)}:${encodeURIComponent(b.id)}`;
        response.interactions.push({ ...rule, id, ruleId: rule.id, medications: [a, b] });
        if (rule.management.action === "separate_doses") {
          response.scheduling.constraints.push({
            interactionId: id,
            medicationIds: [a.id, b.id],
            minimumGapMinutes: rule.management.minimumGapMinutes,
            direction: rule.management.direction,
            appliesAcrossMidnight: true,
          });
        } else {
          // Includes dose checks: missing or ambiguous daily-dose data must not silently clear an alert.
          response.scheduling.reviewInteractionIds.push(id);
        }
      }
    }
  }
  response.scheduling.status = response.scheduling.reviewInteractionIds.length
    ? "review_required"
    : response.scheduling.constraints.length
      ? "spacing_constraints"
      : "no_rules_matched";
  const sourceIds = new Set(response.interactions.flatMap((interaction) => interaction.sourceIds));
  response.sources = interactionDataset.sources.filter((source) => sourceIds.has(source.id));
  return response;
}

/**
 * Checks the medicines a patient chose for their schedule, including ones they
 * added that are not on their record. Uses the same exact-code rules as the
 * record check; medicines without a known code are reported as unchecked.
 */
export function checkSelection(medicines: SelectedMedicine[]): SelectionInteractionsResponse {
  const result = checkInteractions({
    nhsNumber: "",
    medications: medicines.map((medicine) => ({
      id: medicine.id,
      name: medicine.name,
      code: medicine.code,
      system: medicine.system,
      asNeeded: false,
      instructions: [],
    })),
  });
  return {
    datasetVersion: result.datasetVersion,
    clinicallyValidated: false,
    coverage: result.coverage,
    interactions: result.interactions.map((interaction) => ({
      id: interaction.id,
      ruleId: interaction.ruleId,
      severity: interaction.severity,
      action: interaction.management.action,
      minimumGapMinutes:
        interaction.management.action === "separate_doses"
          ? interaction.management.minimumGapMinutes
          : undefined,
      effect: interaction.effect,
      patientGuidance: interaction.patientGuidance,
      medicineIds: [interaction.medications[0].id, interaction.medications[1].id],
      sourceIds: interaction.sourceIds,
    })),
    uncheckedIds: result.uncheckedMedications.map((entry) => entry.medication.id),
    sources: result.sources,
  };
}
