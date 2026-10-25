/**
 * Checks applied to every AI answer before it reaches the patient, whichever
 * model produced it. They fail closed: an answer that does not pass is never
 * shown, and the app falls back to what it shows without AI.
 */

/** Arabic-Indic and Eastern Arabic-Indic (Urdu) digits as ASCII digits. */
export function normaliseDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

// "one" is left out: it is mostly used as a word ("one of your medicines").
const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  twice: 2, half: 0.5,
};

/**
 * Every number in a text, in a canonical form: "08" is "8", "1,000" is "1000"
 * and "0,5" is "0.5". Times are read as hours and minutes, so "8.30" and
 * "8:30" both give 8 and 30.
 */
export function numbersIn(text: string): Set<string> {
  const plain = normaliseDigits(text)
    .toLowerCase()
    .replace(/\b(\d{1,2})[:.](\d{2})(?!\d)/g, "$1 $2")
    // Thousands separators, including the spaces Polish uses.
    .replace(/(\d)[,\u00a0\u202f ](?=\d{3}(?!\d))/g, "$1");
  const numbers = new Set<string>();
  for (const match of plain.matchAll(/\d+(?:[.,]\d+)?/g)) numbers.add(String(Number(match[0].replace(",", "."))));
  for (const match of plain.matchAll(/[a-z]+/g)) {
    const value = NUMBER_WORDS[match[0]];
    if (value !== undefined) numbers.add(String(value));
  }
  return numbers;
}

/**
 * Numbers an answer may use: those in the facts, plus the other ways of
 * writing each time in them, so "19:30" also allows "7:30pm" and "7pm"
 * also allows "19:00".
 */
export function allowedNumbers(facts: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const fact of facts) {
    const text = normaliseDigits(fact);
    for (const number of numbersIn(text)) allowed.add(number);
    for (const match of text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g)) {
      allowed.add(String(Number(match[1]) % 12 || 12));
    }
    for (const match of text.matchAll(/\b(1[0-2]|0?[1-9])(?:[:.]([0-5]\d))?\s?([ap])\.?m\b/gi)) {
      const hour = Number(match[1]) % 12;
      allowed.add(String(match[3].toLowerCase() === "p" ? hour + 12 : hour));
      if (!match[2]) allowed.add("0");
    }
  }
  return allowed;
}

/** Numbers in an answer that are not in its facts, such as an invented dose or time. */
export function unsupportedNumbers(answer: string, facts: string[]): string[] {
  const allowed = allowedNumbers(facts);
  return [...numbersIn(answer)].filter((number) => !allowed.has(number));
}

const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|uk|nhs|io|info)\b/i;
const MARKUP = /<\/?[a-z][^>]*>|```/i;
// English claims that something is safe or free of interactions: "no match" never means safe.
const SAFETY_CLAIM = /\b(is|are|it'?s|they'?re) (completely |perfectly )?safe\b|\bsafe to (take|use|combine)\b|\bno (known )?interactions?\b|\b(do|does|will) not interact\b|\b(don'?t|doesn'?t|won'?t) interact\b/i;

/** Problems with model text that is shown to a patient, or none. */
export function textProblems(text: string, facts: string[], maxLength: number): string[] {
  const problems: string[] = [];
  if (!text.trim()) problems.push("empty");
  if (text.length > maxLength) problems.push("too-long");
  if (LINK.test(text)) problems.push("link");
  if (MARKUP.test(text)) problems.push("markup");
  if (SAFETY_CLAIM.test(text)) problems.push("safety-claim");
  if (unsupportedNumbers(text, facts).length) problems.push("unsupported-number");
  return problems;
}

// ---------------------------------------------------------------------------
// Questions the app answers with fixed wording before any model sees them.
// English, Polish and Urdu, matched loosely: a false match only means the
// patient is pointed to 999, 111 or their pharmacist.
// ---------------------------------------------------------------------------

const EMERGENCY = [
  /chest pain|heart attack|can'?t breathe|cannot breathe|(difficulty|trouble|struggling to) breath|short of breath|overdose|too many (tablets|pills|capsules|doses)|(taken|took|had) too (much|many)|suicid|kill myself|end my life|self[- ]?harm|hurt myself|unconscious|passed out|fainted|collapsed|seizure|stroke|face (is )?drooping|swollen (face|lips|tongue|throat)|swelling (of|in) (my|the|his|her) (face|lips|tongue|throat)|throat (is )?(closing|swelling)|anaphyla|coughing (up )?blood|vomiting blood|bleeding (heavily|won'?t stop|that won'?t stop)/i,
  /ból w klatce|bol w klatce|zawał|nie mogę oddychać|nie moge oddychac|duszno|duszności|przedawkowa|za dużo (tabletek|leków|lekarstw)|samobój|zabić się|skrzywdzić siebie|zrobić sobie krzywdę|stracił[a]? przytomność|nieprzytomn|zemdla|drgawk|udar|obrzęk (twarzy|warg|języka|gardła)|wstrząs anafilakty|silne krwawienie/i,
  /سینے میں درد|دل کا دورہ|سانس (نہیں|لینے میں)|زیادہ گولیاں|زیادہ دوا|خودکشی|خود کو نقصان|بے ہوش|بےہوش|فالج|(چہرے|ہونٹوں|زبان|گلے)( پر| میں) سوجن|بہت زیادہ خون|دورہ پڑ/,
];

const MEDICAL_ADVICE = [
  /\b(missed|miss|forgot|forget|forgotten)\b|\bdouble (dose|up)|extra (dose|tablet)|\bstop(ped|ping)? (taking|using)|come off|(change|increase|decrease|reduce|lower|raise) (my|the) (dose|amount)|take (more|less)\b|side[- ]?effects?|pregnan|breastfeed|breast-feed|alcohol|\b(drink|drinking) (beer|wine|alcohol)|\bdriv(e|ing)\b|\bis it safe\b|\bsafe (to|for)\b|\bdiagnos|symptom/i,
  /zapomnia|pominą|pominię|podwójn|przestać (brać|przyjmować)|odstawi|zmienić dawk|zwiększyć|zmniejszyć|skutki uboczne|działania niepożądane|ciąż|karmi(ę|enie) piersią|alkohol|prowadzić samochód|czy to bezpieczne|bezpieczn/i,
  /بھول|دوگنی|ڈبل خوراک|لینا بند|چھوڑ دوں|خوراک (بدل|کم|زیادہ)|مضر اثرات|سائیڈ ایفیکٹ|حمل|حاملہ|دودھ پلا|شراب|گاڑی چلا|محفوظ/,
];

export type QuestionCheck = "emergency" | "medical-advice" | undefined;

/** Questions that must get the app's fixed emergency or "ask a pharmacist" wording. */
export function checkQuestion(question: string): QuestionCheck {
  if (EMERGENCY.some((pattern) => pattern.test(question))) return "emergency";
  if (MEDICAL_ADVICE.some((pattern) => pattern.test(question))) return "medical-advice";
  return undefined;
}
