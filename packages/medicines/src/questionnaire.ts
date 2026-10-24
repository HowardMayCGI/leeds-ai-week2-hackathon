/**
 * A small renderer-side model for the routine FHIR R4 Questionnaire. It covers
 * the item types this journey uses (group, display, time, boolean) and
 * `enableWhen` with `=`, `!=` and `exists`; it is not a general FHIR engine.
 */
import questionnaireJson from './routine-questionnaire.json';
import { checkRoutine, MEALS, type Meal, type Routine } from './routine';
import { fromFhirTime, parseClockTime, toFhirTime, type ClockTime } from './time';

export const TRANSLATION_URL = 'http://hl7.org/fhir/StructureDefinition/translation';
const ITEM_CONTROL_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const DISPLAY_CATEGORY_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory';

interface Extension {
  url: string;
  valueCode?: string;
  valueString?: string;
  valueCodeableConcept?: { coding: { system?: string; code: string }[] };
  extension?: Extension[];
}

interface ElementWithTranslations {
  extension?: Extension[];
}

export interface EnableWhen {
  question: string;
  operator: '=' | '!=' | 'exists';
  answerBoolean?: boolean;
  answerTime?: string;
}

export interface QuestionnaireItem {
  linkId: string;
  type: 'group' | 'display' | 'time' | 'boolean';
  text?: string;
  _text?: ElementWithTranslations;
  required?: boolean;
  enableWhen?: EnableWhen[];
  enableBehavior?: 'all' | 'any';
  initial?: { valueBoolean?: boolean; valueTime?: string }[];
  extension?: Extension[];
  item?: QuestionnaireItem[];
}

export interface Questionnaire {
  resourceType: 'Questionnaire';
  url: string;
  version: string;
  language: string;
  title: string;
  _title?: ElementWithTranslations;
  status: string;
  item: QuestionnaireItem[];
}

export interface QuestionnaireResponseItem {
  linkId: string;
  text?: string;
  answer?: { valueTime?: string; valueBoolean?: boolean }[];
  item?: QuestionnaireResponseItem[];
}

export interface QuestionnaireResponse {
  resourceType: 'QuestionnaireResponse';
  questionnaire: string;
  status: 'in-progress' | 'completed';
  authored: string;
  language: string;
  item: QuestionnaireResponseItem[];
}

/** Answers keyed by `linkId`: `HH:MM` for times, booleans for yes/no. Independent of display language. */
export type Answers = Record<string, string | boolean | undefined>;

export const ROUTINE_QUESTIONNAIRE = questionnaireJson as unknown as Questionnaire;

export interface LocalisedText {
  text: string;
  /** The language the text is actually in; differs from the request when falling back. */
  lang: string;
}

export function localise(text: string | undefined, element: ElementWithTranslations | undefined, lang: string, base = ROUTINE_QUESTIONNAIRE.language): LocalisedText {
  if (lang !== base) {
    for (const extension of element?.extension ?? []) {
      if (extension.url !== TRANSLATION_URL) continue;
      const code = extension.extension?.find(part => part.url === 'lang')?.valueCode;
      const content = extension.extension?.find(part => part.url === 'content')?.valueString;
      if (code === lang && content) return { text: content, lang };
    }
  }
  return { text: text ?? '', lang: base };
}

export function itemText(item: QuestionnaireItem, lang: string): LocalisedText {
  return localise(item.text, item._text, lang);
}

export function itemControl(item: QuestionnaireItem): string | undefined {
  return item.extension?.find(extension => extension.url === ITEM_CONTROL_URL)?.valueCodeableConcept?.coding[0]?.code;
}

export function isInstructions(item: QuestionnaireItem): boolean {
  return item.type === 'display' && Boolean(item.extension?.some(extension => extension.url === DISPLAY_CATEGORY_URL && extension.valueCodeableConcept?.coding.some(coding => coding.code === 'instructions')));
}

/** Short hint text shown with a question, held as a child display item. */
export function hintFor(item: QuestionnaireItem): QuestionnaireItem | undefined {
  return item.item?.find(child => child.type === 'display' && itemControl(child) === 'inline');
}

export function flatten(items: QuestionnaireItem[] = ROUTINE_QUESTIONNAIRE.item): QuestionnaireItem[] {
  return items.flatMap(item => [item, ...flatten(item.item ?? [])]);
}

export function findItem(linkId: string): QuestionnaireItem | undefined {
  return flatten().find(item => item.linkId === linkId);
}

/** The top-level groups, each rendered as one screen. */
export function routinePages(): QuestionnaireItem[] {
  return ROUTINE_QUESTIONNAIRE.item.filter(item => item.type === 'group');
}

export function initialAnswers(): Answers {
  const answers: Answers = {};
  for (const item of flatten()) {
    const initial = item.initial?.[0];
    if (initial?.valueBoolean !== undefined) answers[item.linkId] = initial.valueBoolean;
  }
  return answers;
}

export function isEnabled(item: QuestionnaireItem, answers: Answers): boolean {
  if (!item.enableWhen?.length) return true;
  const results = item.enableWhen.map(condition => {
    const answer = answers[condition.question];
    if (condition.operator === 'exists') return (answer !== undefined && answer !== '') === (condition.answerBoolean ?? true);
    const expected = condition.answerBoolean ?? (condition.answerTime ? fromFhirTime(condition.answerTime) : undefined);
    return condition.operator === '=' ? answer === expected : answer !== expected;
  });
  return item.enableBehavior === 'any' ? results.some(Boolean) : results.every(Boolean);
}

/** Records an answer and drops answers to any questions it disables, so stale times are never kept. */
export function setAnswer(answers: Answers, linkId: string, value: string | boolean | undefined): Answers {
  const next = { ...answers, [linkId]: value };
  for (const item of flatten()) {
    if (item.type !== 'group' && item.type !== 'display' && !isEnabled(item, next)) delete next[item.linkId];
  }
  return next;
}

export type FieldError =
  | { linkId: string; code: 'required' | 'invalid-time' }
  | { linkId: string; code: 'sleep-same-as-wake' }
  | { linkId: string; code: 'meal-outside-waking-day'; meal: Meal }
  | { linkId: string; code: 'meals-out-of-order'; meal: Meal; previous: Meal };

function questions(group: QuestionnaireItem): QuestionnaireItem[] {
  return flatten(group.item).filter(item => item.type === 'time' || item.type === 'boolean');
}

/** Validates one screen. Cross-field checks run once each field on the screen is valid. */
export function validatePage(group: QuestionnaireItem, answers: Answers): FieldError[] {
  const errors: FieldError[] = [];
  for (const item of questions(group)) {
    if (!isEnabled(item, answers)) continue;
    const answer = answers[item.linkId];
    if (item.type === 'time') {
      if (answer === undefined || answer === '') { if (item.required) errors.push({ linkId: item.linkId, code: 'required' }); }
      else if (parseClockTime(String(answer)) === null) errors.push({ linkId: item.linkId, code: 'invalid-time' });
    }
  }
  if (errors.length) return errors;
  const pageIds = new Set(questions(group).map(item => item.linkId));
  const routine = toRoutine(answers);
  if (!routine) return [];
  for (const issue of checkRoutine(routine)) {
    const linkId = issue.code === 'sleep-same-as-wake' ? 'sleep-time' : `${issue.meal}-time`;
    if (pageIds.has(linkId)) errors.push({ linkId, ...issue } as FieldError);
  }
  return errors;
}

/** Converts answers to a routine, or `null` while any needed answer is missing. */
export function toRoutine(answers: Answers): Routine | null {
  const time = (linkId: string) => (typeof answers[linkId] === 'string' && parseClockTime(answers[linkId] as string) !== null ? answers[linkId] as ClockTime : null);
  const wake = time('wake-time');
  const sleep = time('sleep-time');
  if (!wake || !sleep) return null;
  const meals = {} as Routine['meals'];
  for (const meal of MEALS) {
    if (answers[`${meal}-skipped`] === true) meals[meal] = null;
    else {
      const value = time(`${meal}-time`);
      if (!value) return null;
      meals[meal] = value;
    }
  }
  return { wake, sleep, meals };
}

function responseItems(items: QuestionnaireItem[], answers: Answers): QuestionnaireResponseItem[] {
  const out: QuestionnaireResponseItem[] = [];
  for (const item of items) {
    if (item.type === 'display' || !isEnabled(item, answers)) continue;
    if (item.type === 'group') {
      const children = responseItems(item.item ?? [], answers);
      if (children.length) out.push({ linkId: item.linkId, text: item.text, item: children });
      continue;
    }
    const value = answers[item.linkId];
    if (value === undefined || value === '') continue;
    out.push({ linkId: item.linkId, text: item.text, answer: [item.type === 'time' ? { valueTime: toFhirTime(String(value)) } : { valueBoolean: Boolean(value) }] });
  }
  return out;
}

/** A QuestionnaireResponse pinned to this exact Questionnaire version. Texts are the base-language originals. */
export function buildResponse(answers: Answers, authored: string, language: string): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: `${ROUTINE_QUESTIONNAIRE.url}|${ROUTINE_QUESTIONNAIRE.version}`,
    status: 'completed',
    authored,
    language,
    item: responseItems(ROUTINE_QUESTIONNAIRE.item, answers),
  };
}

export function answersFromResponse(response: QuestionnaireResponse): Answers {
  const answers: Answers = {};
  const walk = (items: QuestionnaireResponseItem[]) => {
    for (const item of items) {
      const answer = item.answer?.[0];
      if (answer?.valueTime !== undefined) answers[item.linkId] = fromFhirTime(answer.valueTime) ?? undefined;
      if (answer?.valueBoolean !== undefined) answers[item.linkId] = answer.valueBoolean;
      walk(item.item ?? []);
    }
  };
  walk(response.item);
  return answers;
}
