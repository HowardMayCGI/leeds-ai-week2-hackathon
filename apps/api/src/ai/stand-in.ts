import type { AskRequest, ExplainRequest, MedicineReadingRequest } from "@hackathon/api-contract";
import type { AiEngine } from "./engine";

/**
 * Test mode: simple rules that answer the AI tasks without calling a model, so
 * the app and its tests run offline. Answers are English only and go through
 * the same checks as live answers. Not used when a model is configured.
 */

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, half: 0.5, a: 1, an: 1 };
const number = (word: string) => WORD_NUMBERS[word.toLowerCase()] ?? Number(word);

/** A photo always reads as this pharmacy label, which is enough to try the journey. */
const PHOTO_READING = {
  found: true,
  name: "Ferrous sulfate",
  brand: null,
  strength: "325mg",
  form: "tablet",
  amount: 1,
  amountMax: null,
  timesPerDay: 1,
  asNeeded: false,
  lessThanDaily: false,
  timing: null,
  instructions: "Do not take indigestion remedies at the same time of day as this medicine",
};

const FORM_WORDS: [RegExp, string][] = [
  [/capsule/, "capsule"], [/tablet|caplet|pill/, "tablet"], [/liquid|syrup|solution|suspension/, "oral-liquid"],
  [/inhaler|puff/, "inhaler"], [/spray/, "spray"], [/patch/, "patch"], [/injection|injector|pen\b/, "injection"],
];
const STOP_WORDS = new Set(["i", "take", "takes", "taking", "my", "a", "an", "the", "some", "also", "and", "use", "have"]);

function readDescription(description: string) {
  const text = description.toLowerCase();
  const strength = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|micrograms?|g|ml|units?|iu)\b/i.exec(description);
  const words = description.replace(/[^A-Za-z\s-]/g, " ").split(/\s+/).filter(Boolean);
  const nameWords: string[] = [];
  for (const word of words) {
    if (STOP_WORDS.has(word.toLowerCase())) { if (nameWords.length) break; continue; }
    if (/^(mg|mcg|units?|tablets?|capsules?|once|twice|daily|every|with|before|after|when|at|in|a|day|times)$/i.test(word)) break;
    nameWords.push(word);
    if (nameWords.length === 3) break;
  }
  if (!nameWords.length) return { found: false };
  const amount = /\b(?:take\s+)?(\d+(?:\.\d+)?|one|two|three|four|half|a|an)\s+(?:x\s+)?(tablets?|capsules?|caplets?|puffs?|sprays?|drops?|sachets?|patch(?:es)?)\b/i.exec(description);
  const range = /\b(\d|one|two)\s+or\s+(\d|two|three|four)\s+(tablets?|capsules?|puffs?)/i.exec(description);
  let timesPerDay: number | null = null;
  const times = /\b(\d|one|two|three|four)\s+times\s+(a|per|each)\s+day\b/i.exec(description);
  if (times) timesPerDay = number(times[1]);
  else if (/\bfour times\b/.test(text)) timesPerDay = 4;
  else if (/\bthree times\b/.test(text)) timesPerDay = 3;
  else if (/\btwice\b/.test(text)) timesPerDay = 2;
  else if (/\b(once|daily|every day|each day|every (morning|evening|night)|at night|in the morning|(a|per|each) day)\b/.test(text)) timesPerDay = 1;
  const asNeeded = /\b(when|as|if) (needed|required)\b|\bprn\b/.test(text);
  const lessThanDaily = /\b(weekly|once a week|every other day|every week)\b/.test(text);
  const timing = /\b(before (food|meals?|breakfast|eating)|empty stomach)\b/.test(text)
    ? "before-food"
    : /\b(with|after) (food|meals?|breakfast|lunch|dinner|tea|my meals?)\b/.test(text) ? "with-food" : null;
  return {
    found: true,
    name: nameWords.map((word, index) => (index === 0 ? word[0].toUpperCase() + word.slice(1) : word)).join(" "),
    brand: null,
    strength: strength ? `${strength[1]}${/^(units?|micrograms?|iu)$/i.test(strength[2]) ? " " : ""}${strength[2].toLowerCase()}` : null,
    form: FORM_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null,
    amount: range ? number(range[1]) : amount ? number(amount[1]) : null,
    amountMax: range ? number(range[2]) : null,
    timesPerDay: asNeeded || lessThanDaily ? null : timesPerDay,
    asNeeded,
    lessThanDaily,
    timing,
    instructions: null,
  };
}

// ---------------------------------------------------------------------------
// Routine: the nearest time after each part of the day that is mentioned.
// ---------------------------------------------------------------------------

const HOUR_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const HOUR = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const TIME = new RegExp(
  `\\b(?:(noon|midday|midnight)|half (?:past )?${HOUR}|quarter (past|to) ${HOUR}|${HOUR}(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.|o'?clock)?)\\b`,
  "gi",
);
const hourOf = (word: string) => HOUR_WORDS[word.toLowerCase()] ?? Number(word);

type Part = "wake" | "breakfast" | "lunch" | "dinner" | "sleep";
const PART_WORDS: [Part, RegExp][] = [
  ["wake", /\b(wake|woke|waking|get up|got up|getting up|up at)\b/gi],
  ["breakfast", /\bbreakfast\b/gi],
  ["lunch", /\blunch\b/gi],
  ["dinner", /\b(tea|dinner|supper|evening meal)\b/gi],
  ["sleep", /\b(bed|sleep|asleep|bedtime)\b/gi],
];

function readTime(match: RegExpExecArray, part: Part): string | null {
  let hour: number;
  let minutes = 0;
  let period: string | undefined;
  if (match[1]) {
    const word = match[1].toLowerCase();
    return word === "midnight" ? "00:00" : "12:00";
  } else if (match[2]) {
    hour = hourOf(match[2]);
    minutes = 30;
  } else if (match[3]) {
    hour = hourOf(match[4]);
    minutes = match[3].toLowerCase() === "past" ? 15 : 45;
    if (minutes === 45) hour -= 1;
  } else {
    hour = hourOf(match[5]);
    minutes = match[6] ? Number(match[6]) : 0;
    period = match[7]?.toLowerCase().replace(/\./g, "");
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || minutes > 59) return null;
  if (hour <= 12 && (period === "am" || period === "pm")) hour = (hour % 12) + (period === "pm" ? 12 : 0);
  else if (hour <= 12 && !period?.startsWith("a") && !period?.startsWith("p")) {
    // No am or pm: the usual part of the day.
    if (part === "dinner" && hour < 12) hour += 12;
    else if (part === "lunch" && hour < 6) hour += 12;
    else if (part === "sleep" && hour >= 6 && hour < 12) hour += 12;
    else if (part === "sleep" && hour === 12) hour = 0;
  }
  return `${String(hour % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function readRoutine(description: string) {
  const text = description.toLowerCase();
  const times = [...description.matchAll(TIME)];
  const found: Partial<Record<Part, string | null>> = {};
  for (const [part, words] of PART_WORDS) {
    for (const word of description.matchAll(words)) {
      const after = times.find((time) => time.index! >= word.index! && time.index! - word.index! <= 40);
      const value = after ? readTime(after, part) : null;
      if (value) { found[part] = value; break; }
    }
  }
  const skipped = (meal: string) => new RegExp(`\\b(skip|miss|don'?t (have|eat)|never (have|eat)|no) ${meal}\\b`).test(text);
  const meal = (part: "breakfast" | "lunch" | "dinner", name: string) =>
    skipped(name) ? { time: null, skipped: true } : { time: found[part] ?? null, skipped: false };
  return {
    wake: found.wake ?? null,
    sleep: found.sleep ?? null,
    breakfast: meal("breakfast", "breakfast"),
    lunch: meal("lunch", "lunch"),
    dinner: meal("dinner", "(tea|dinner|supper|evening meal)"),
  };
}

export function standInEngine(): AiEngine {
  return {
    mode: "test",
    translates: false,
    async medicine(request: MedicineReadingRequest) {
      return request.image ? PHOTO_READING : readDescription(request.description ?? "");
    },
    async routine(text: string) {
      return readRoutine(text);
    },
    // Each dose's reasons, as the facts give them.
    async explain(request: ExplainRequest) {
      return {
        explanations: request.doses.map((dose) => {
          const reasons = dose.facts.filter((fact) => /:(reason|own-timing|not-matched|fits-day)/.test(fact.id)).map((fact) => fact.text.replace(/^Why:\s*/, ""));
          return { id: dose.id, text: reasons.length ? reasons.join(" ") : "This time fits your day and keeps your doses spread out." };
        }),
      };
    },
    // Facts that mention a medicine named in the question.
    async ask(request: AskRequest) {
      const question = request.question.toLowerCase();
      const cited = request.facts.filter((fact) => {
        const name = /^([A-Za-z][A-Za-z-]+)/.exec(fact.text)?.[1]?.toLowerCase();
        return fact.id.startsWith("dose") && name && name.length > 3 && question.includes(name);
      });
      if (!cited.length) return { kind: "cannot-answer", reason: "outside-schedule", text: null, factIds: [] };
      return { kind: "answer", reason: null, text: cited.map((fact) => fact.text).join(" "), factIds: cited.map((fact) => fact.id) };
    },
  };
}
