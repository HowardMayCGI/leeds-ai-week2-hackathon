import { AI_LIMITS, type ScheduleFact, type SelectionInteractionsResponse } from '@hackathon/api-contract';
import {
  DEFAULT_MIN_INTERVAL_HOURS, MEALS, rulesFor,
  type DoseNote, type ItemSnapshot, type Meal, type Proposal,
} from '@hackathon/medicines';
import { formatAmount, formatDate, formatTime, translate, type Language, type MessageKey, type Params } from './i18n';
import type { Permission } from './state';

/**
 * What the app knows about a schedule, as short English facts. These are all
 * the AI may use to explain the schedule or answer a question about it, and
 * the API checks every answer against them. Times are written as the app
 * shows them in the patient's language, so answers can copy them exactly.
 */

type OkProposal = Extract<Proposal, { status: 'ok' }>;
export type Interaction = SelectionInteractionsResponse['interactions'][number];

/** Where a fact came from, so the app can name its sources in the patient's own language. */
export type FactSource =
  | { kind: 'routine' }
  | { kind: 'dose'; key: string; time: string }
  | { kind: 'medicine'; key: string }
  | { kind: 'interaction' }
  | { kind: 'reminders' }
  | { kind: 'review' };

export interface DoseFacts {
  /** A short id for the AI, such as "d3". */
  id: string;
  key: string;
  minute: number;
  facts: ScheduleFact[];
}

export interface ScheduleFacts {
  /** The patient's usual day, which applies to every dose. */
  routine: ScheduleFact[];
  /** What decided each dose's time, for explaining it. */
  doses: DoseFacts[];
  /** Everything about the schedule, for answering questions. */
  all: ScheduleFact[];
  sources: Record<string, FactSource>;
}

export interface ScheduleContext {
  interactions?: Interaction[];
  reminders?: { enabled: boolean; permission: Permission };
  savedAt?: string;
  reviewRequestedAt?: string;
}

const en = (key: MessageKey, params?: Params) => translate('en', key, params).text;
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const DOSES_PER_DAY: Record<string, number> = { 'once-daily': 1, 'twice-daily': 2, 'three-times-daily': 3, 'four-times-daily': 4 };
const MEAL_NAMES: Record<Meal, string> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'your evening meal' };

/** A fact's text, cut at a word to the length the API accepts. */
function fact(id: string, text: string): ScheduleFact {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= AI_LIMITS.factChars) return { id, text: clean };
  return { id, text: `${clean.slice(0, AI_LIMITS.factChars - 1).replace(/\s+\S*$/, '')}…` };
}

export function itemLabel(item: ItemSnapshot): string {
  return `${item.name}${item.strength ? ` ${item.strength}` : ''}`;
}

function amount(item: ItemSnapshot): string {
  return item.dose ? formatAmount(item.dose, 'en').text : 'dose not recorded';
}

function noteText(note: DoseNote, items: ItemSnapshot[]): string {
  switch (note.code) {
    case 'with-meal': return en(`notes.withMeal.${note.meal}`);
    case 'at-meal-time': return en(`notes.atMealTime.${note.meal}`);
    case 'before-meal': return en(`notes.beforeMeal.${note.meal}`, { minutes: note.minutes });
    case 'empty-stomach': return en('notes.emptyStomach');
    case 'on-waking': return en('notes.onWaking');
    case 'at-bedtime': return en('notes.atBedtime');
    case 'in-evening': return en('notes.inEvening');
    case 'before-others': return en('notes.beforeOthers', { minutes: note.minutes });
    case 'apart-from': {
      const other = items.find(item => item.key === note.key);
      return en('notes.apartFrom', { hours: note.hours, name: other ? itemLabel(other) : 'another medicine' });
    }
  }
}

/** The reasons in the rules for this item's timing, and for keeping it apart from the others it is noted against. */
function reasons(item: ItemSnapshot, notes: DoseNote[], items: ItemSnapshot[]): string[] {
  // A timing the patient chose to keep replaces the rules, so their reasons no longer apply.
  if (item.timingFlag) return [];
  const found = rulesFor(item.ingredients).map(rule => rule.reason).filter((reason): reason is string => Boolean(reason));
  for (const note of notes) {
    if (note.code !== 'apart-from') continue;
    const other = items.find(candidate => candidate.key === note.key);
    if (!other) continue;
    for (const [mine, theirs] of [[item, other], [other, item]]) {
      for (const rule of rulesFor(mine.ingredients)) {
        for (const separation of rule.separateFrom ?? []) {
          if (theirs.ingredients.some(ingredient => separation.ingredients.includes(ingredient))) found.push(separation.reason);
        }
      }
    }
  }
  return [...new Set(found)];
}

function frequencyText(item: ItemSnapshot): string | undefined {
  if (item.everyDays) return `every ${item.everyDays} days`;
  return item.frequency ? lower(en(`frequencies.${item.frequency}`)) : undefined;
}

function interactionText(interaction: Interaction, proposal: OkProposal): string {
  const [first, second] = interaction.medicineIds.map(key => {
    const item = proposal.items.find(candidate => candidate.key === key);
    return item ? itemLabel(item) : 'another medicine';
  });
  const met = gapMet(interaction, proposal) ? ` Your schedule keeps them at least ${interaction.minimumGapMinutes! / 60} hours apart.` : '';
  return `${first} and ${second} can interact. ${interaction.effect} ${interaction.patientGuidance}${met}`;
}

const PERMISSION_TEXT: Record<Permission, string> = {
  granted: 'Notifications are allowed on this device.',
  denied: 'Notifications are not allowed on this device, so reminders will not arrive until they are allowed.',
  'not-requested': 'Notifications have not been allowed on this device yet.',
};

export function scheduleFacts(proposal: OkProposal, lang: Language, context: ScheduleContext = {}): ScheduleFacts {
  const time = (value: string) => formatTime(value, lang);
  const items = proposal.items;
  const byKey = new Map(items.map(item => [item.key, item]));
  const sources: ScheduleFacts['sources'] = {};
  const routine: ScheduleFact[] = [];
  const all: ScheduleFact[] = [];
  const add = (list: ScheduleFact[], source: FactSource, entry: ScheduleFact) => {
    list.push(entry);
    sources[entry.id] = source;
  };

  // The patient's day.
  const { wake, sleep, meals } = proposal.routine;
  add(routine, { kind: 'routine' }, fact('routine:wake', `You usually wake up at ${time(wake)}.`));
  for (const meal of MEALS) {
    const at = meals[meal];
    add(routine, { kind: 'routine' }, fact(`routine:${meal}`, at ? `You usually have ${MEAL_NAMES[meal]} at ${time(at)}.` : `You do not usually eat ${MEAL_NAMES[meal]}.`));
  }
  add(routine, { kind: 'routine' }, fact('routine:sleep', `You usually go to sleep at ${time(sleep)}.`));
  all.push(...routine);

  // Each dose, with what decided its time.
  const doses: DoseFacts[] = proposal.doses.map((dose, index) => {
    const item = byKey.get(dose.key)!;
    const id = `d${index + 1}`;
    const label = itemLabel(item);
    const at = time(dose.time);
    const notes = dose.notes.map(note => noteText(note, items));
    const facts: ScheduleFact[] = [fact(`${id}:dose`, `${label}: ${amount(item)} at ${at}.`)];
    const frequency = frequencyText(item);
    const perDay = item.frequency ? DOSES_PER_DAY[item.frequency] : undefined;
    if (frequency) facts.push(fact(`${id}:how-often`, `You take ${label} ${frequency}.`));
    if (perDay && perDay > 1 && DEFAULT_MIN_INTERVAL_HOURS[perDay]) {
      facts.push(fact(`${id}:spacing`, `Doses of ${label} are spread through your waking day, at least ${DEFAULT_MIN_INTERVAL_HOURS[perDay]} hours apart.`));
    }
    notes.forEach((note, number) => facts.push(fact(`${id}:note:${number + 1}`, `${label} at ${at}: ${lower(note)}.`)));
    const why = reasons(item, dose.notes, items);
    why.forEach((reason, number) => facts.push(fact(`${id}:reason:${number + 1}`, `Why: ${reason}`)));
    if (item.timingFlag) facts.push(fact(`${id}:own-timing`, en(`flag.schedule.${item.timingFlag.recommended}`, { name: label })));
    else if (item.source === 'patient' && !rulesFor(item.ingredients).some(rule => rule.food) && (item.timing === 'before-food' || item.timing === 'with-food')) {
      facts.push(fact(`${id}:own-timing`, `You told us you take ${label} ${lower(en(`timings.${item.timing}`))}.`));
    }
    if (!item.matched) facts.push(fact(`${id}:not-matched`, `Why: ${en('proposal.unmatched')}`));
    if (!why.length && item.matched && !item.timingFlag) {
      facts.push(fact(`${id}:fits-day`, `The app has no food or time-of-day instructions for ${label}, so ${at} was chosen to fit around your day.`));
    }
    return { id, key: dose.key, minute: dose.minute, facts };
  });

  // For questions: one fact per dose, then each medicine's reasons and anything without set times.
  proposal.doses.forEach((dose, index) => {
    const item = byKey.get(dose.key)!;
    const notes = dose.notes.map(note => lower(noteText(note, items)));
    add(all, { kind: 'dose', key: dose.key, time: dose.time },
      fact(`dose:${index + 1}`, `${itemLabel(item)}: ${amount(item)} at ${time(dose.time)}${notes.length ? `, ${notes.join(', ')}` : ''}.`));
  });
  const scheduled = items.filter(item => proposal.doses.some(dose => dose.key === item.key));
  scheduled.forEach((item, index) => {
    const notes = proposal.doses.filter(dose => dose.key === item.key).flatMap(dose => dose.notes);
    const why = reasons(item, notes, items);
    const frequency = frequencyText(item);
    const parts = [
      frequency && `You take it ${frequency}.`,
      ...why,
      item.timingFlag && en(`flag.schedule.${item.timingFlag.recommended}`, { name: itemLabel(item) }),
      !item.matched && en('proposal.unmatched'),
      item.source === 'patient' && 'You added this yourself. It is not on your medical record.',
    ].filter((part): part is string => Boolean(part));
    if (parts.length) add(all, { kind: 'medicine', key: item.key }, fact(`medicine:${index + 1}`, `${itemLabel(item)}: ${parts.join(' ')}`));
  });
  proposal.whenNeeded.forEach((key, index) => {
    const item = byKey.get(key)!;
    add(all, { kind: 'medicine', key }, fact(`when-needed:${index + 1}`, `${itemLabel(item)}: ${amount(item)}, only when needed. It has no set times in your schedule.`));
  });
  proposal.notDaily.forEach((key, index) => {
    const item = byKey.get(key)!;
    add(all, { kind: 'medicine', key }, fact(`not-daily:${index + 1}`, `${itemLabel(item)}: ${amount(item)}, ${frequencyText(item) ?? 'less often than once a day'}. It is not taken every day, so it has no times in your daily schedule.`));
  });
  (proposal.unscheduled ?? []).forEach((key, index) => {
    const item = byKey.get(key)!;
    add(all, { kind: 'medicine', key }, fact(`unscheduled:${index + 1}`, `${itemLabel(item)}: your record does not say how often to take it, so it has no times in your schedule. Keep taking it as your doctor or pharmacist told you.`));
  });
  (context.interactions ?? []).forEach((interaction, index) => {
    add(all, { kind: 'interaction' }, fact(`interaction:${index + 1}`, interactionText(interaction, proposal)));
  });
  if (context.reminders) {
    const { enabled, permission } = context.reminders;
    add(all, { kind: 'reminders' }, fact('reminders', enabled ? `Medicine reminders are switched on. ${PERMISSION_TEXT[permission]}` : 'Medicine reminders are switched off.'));
  }
  if (context.savedAt) {
    add(all, { kind: 'review' }, fact('saved', `You saved this schedule on ${formatDate(context.savedAt, 'en')}.`));
    add(all, { kind: 'review' }, fact('review', context.reviewRequestedAt
      ? `You asked a pharmacist to review this schedule on ${formatDate(context.reviewRequestedAt, 'en')}. You can keep using it in the meantime.`
      : 'A pharmacist review is optional. You can ask for one from your schedule.'));
  }
  return { routine, doses, all: all.slice(0, AI_LIMITS.facts), sources };
}

/** Whether a "keep apart" interaction is met by the schedule's times. */
export function gapMet(interaction: Interaction, proposal: OkProposal): boolean {
  if (interaction.action !== 'separate_doses' || !interaction.minimumGapMinutes) return false;
  const [first, second] = interaction.medicineIds.map(key => proposal.doses.filter(dose => dose.key === key).map(dose => dose.minute));
  if (!first.length || !second.length) return false;
  return first.every(a => second.every(b => Math.abs(a - b) >= interaction.minimumGapMinutes!));
}
