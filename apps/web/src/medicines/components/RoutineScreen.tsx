'use client';

import { useState } from 'react';
import {
  flatten, hintFor, isEnabled, isInstructions, itemControl, itemText, setAnswer, validatePage,
  type Answers, type FieldError, type QuestionnaireItem,
} from '@hackathon/medicines';
import { useJourney } from '../context';
import type { MessageKey } from '../i18n';
import type { Screen } from '../state';
import { BackLink, Button, Caption, ErrorMessage, ErrorSummary, PageHeading, T } from './ui';

/** Questionnaire text, marked with its language if a translation is missing. */
function QText({ item }: { item: QuestionnaireItem }) {
  const { lang } = useJourney();
  const text = itemText(item, lang);
  return text.lang === lang ? <>{text.text}</> : <span lang={text.lang} dir="ltr">{text.text}</span>;
}

// ---------------------------------------------------------------------------
// 12-hour time entry. Patients type the hour and minutes and choose am or pm.
// The answer is only stored, as 24-hour "HH:MM", once all three are valid.
// ---------------------------------------------------------------------------

type Period = 'am' | 'pm';
interface TimeParts { hour: string; minutes: string; period?: Period }
type EntryError = 'hour' | 'minutes' | 'period';

function partsFrom(value: unknown): TimeParts {
  const match = typeof value === 'string' ? /^(\d{2}):(\d{2})$/.exec(value) : null;
  if (!match) return { hour: '', minutes: '' };
  const hours = Number(match[1]);
  return { hour: String(hours % 12 || 12), minutes: match[2], period: hours < 12 ? 'am' : 'pm' };
}

/** Converts entered parts to "HH:MM", or reports which part is wrong. Blank minutes mean on the hour. */
export function readTime(parts: TimeParts): { value?: string; error?: EntryError; empty?: boolean } {
  const hour = parts.hour.trim();
  const minutes = parts.minutes.trim();
  if (!hour && !minutes && !parts.period) return { empty: true };
  if (!/^\d{1,2}$/.test(hour) || Number(hour) < 1 || Number(hour) > 12) return { error: 'hour' };
  if (minutes && (!/^\d{1,2}$/.test(minutes) || Number(minutes) > 59)) return { error: 'minutes' };
  if (!parts.period) return { error: 'period' };
  const hours = (Number(hour) % 12) + (parts.period === 'pm' ? 12 : 0);
  return { value: `${String(hours).padStart(2, '0')}:${(minutes || '0').padStart(2, '0')}` };
}

type PageError = FieldError | { linkId: string; code: EntryError };

function errorKey(error: PageError): MessageKey {
  switch (error.code) {
    case 'required': return `routine.errors.required.${error.linkId}` as MessageKey;
    case 'hour': return 'routine.errors.hour';
    case 'minutes': return 'routine.errors.minutes';
    case 'period': return 'routine.errors.period';
    case 'invalid-time': return 'routine.errors.invalidTime';
    case 'sleep-same-as-wake': return 'routine.errors.sleepSameAsWake';
    case 'meal-outside-waking-day': return `routine.errors.outsideDay.${error.meal}`;
    case 'meals-out-of-order': return `routine.errors.outOfOrder.${error.meal}`;
  }
}

/** The field an error links to: the part of the time that needs fixing. */
function errorTarget(error: PageError): string {
  if (error.code === 'minutes') return `${error.linkId}-minutes`;
  if (error.code === 'period') return `${error.linkId}-am`;
  return error.linkId;
}

function TimeInput({ item, parts, error, onChange, headingLevel }: {
  item: QuestionnaireItem;
  parts: TimeParts;
  error?: PageError;
  onChange: (parts: TimeParts) => void;
  headingLevel: 'm' | 's';
}) {
  const { t } = useJourney();
  const hint = hintFor(item);
  const id = item.linkId;
  // A required or cross-field error marks the whole time; an entry error marks only its part.
  const wrong = (part: 'hour' | 'minutes') => Boolean(error) && (error!.code === part || !['hour', 'minutes', 'period'].includes(error!.code));
  const legend = <QText item={item} />;
  return (
    <div className={`nhsuk-form-group${error ? ' nhsuk-form-group--error' : ''}`}>
      <fieldset className="nhsuk-fieldset" role="group" aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}>
        <legend className={`nhsuk-fieldset__legend nhsuk-fieldset__legend--${headingLevel}`}>
          {headingLevel === 'm' ? <h2 className="nhsuk-fieldset__heading">{legend}</h2> : legend}
        </legend>
        <div className="nhsuk-hint" id={`${id}-hint`}>
          {hint && <><QText item={hint} /> </>}<T k="time.hint" />
        </div>
        {error && <ErrorMessage id={`${id}-error`}><T k={errorKey(error)} /></ErrorMessage>}
        <div className="app-time-input" dir="ltr">
          <div className="nhsuk-date-input">
            <div className="nhsuk-date-input__item">
              <div className="nhsuk-form-group">
                <label className="nhsuk-label nhsuk-date-input__label" htmlFor={id}><T k="time.hour" /></label>
                <input className={`nhsuk-input nhsuk-date-input__input nhsuk-input--width-2${wrong('hour') ? ' nhsuk-input--error' : ''}`}
                  id={id} name={`${id}-hour`} type="text" inputMode="numeric" autoComplete="off" maxLength={2}
                  value={parts.hour} onChange={event => onChange({ ...parts, hour: event.target.value })} />
              </div>
            </div>
            <span className="app-time-input__separator" aria-hidden="true">:</span>
            <div className="nhsuk-date-input__item">
              <div className="nhsuk-form-group">
                <label className="nhsuk-label nhsuk-date-input__label" htmlFor={`${id}-minutes`}><T k="time.minutes" /></label>
                <input className={`nhsuk-input nhsuk-date-input__input nhsuk-input--width-2${wrong('minutes') ? ' nhsuk-input--error' : ''}`}
                  id={`${id}-minutes`} name={`${id}-minutes`} type="text" inputMode="numeric" autoComplete="off" maxLength={2}
                  value={parts.minutes} onChange={event => onChange({ ...parts, minutes: event.target.value })} />
              </div>
            </div>
          </div>
          <div className="nhsuk-radios nhsuk-radios--inline nhsuk-radios--small app-time-input__period" role="radiogroup" aria-label={t('time.period')}>
            {(['am', 'pm'] as const).map(period => (
              <div className="nhsuk-radios__item" key={period}>
                <input className="nhsuk-radios__input" id={`${id}-${period}`} name={`${id}-period`} type="radio" value={period}
                  checked={parts.period === period} onChange={() => onChange({ ...parts, period })} />
                <label className="nhsuk-label nhsuk-radios__label" htmlFor={`${id}-${period}`}><T k={`time.${period}`} /></label>
              </div>
            ))}
          </div>
        </div>
      </fieldset>
    </div>
  );
}

/**
 * Renders one top-level Questionnaire group as a screen. Question text, hints
 * and conditional display all come from the Questionnaire resource.
 */
export function RoutineScreen({ group, previous, nextScreen }: { group: QuestionnaireItem; previous: Screen; nextScreen: Screen }) {
  const { state, t, updateDraft, next, back } = useJourney();
  const answers = state.draft.answers;
  const timeItems = flatten(group.item ?? []).filter(item => item.type === 'time');
  const [parts, setParts] = useState<Record<string, TimeParts>>(() => Object.fromEntries(timeItems.map(item => [item.linkId, partsFrom(answers[item.linkId])])));
  const [errors, setErrors] = useState<PageError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const screen = group.linkId as Screen;
  const errorFor = (linkId: string) => errors.find(error => error.linkId === linkId);
  const clearError = (linkId: string) => {
    if (errorFor(linkId)) setErrors(current => current.filter(error => error.linkId !== linkId));
  };

  const update = (linkId: string, value: string | boolean | undefined) => {
    updateDraft(draft => ({ ...draft, answers: setAnswer(draft.answers, linkId, value) }));
    clearError(linkId);
  };

  const changeTime = (linkId: string, next: TimeParts) => {
    setParts(current => ({ ...current, [linkId]: next }));
    updateDraft(draft => ({ ...draft, answers: setAnswer(draft.answers, linkId, readTime(next).value) }));
    clearError(linkId);
  };

  const submit = () => {
    // Re-read every shown time, including one shown again after a meal was un-skipped.
    let current: Answers = answers;
    const entryErrors: PageError[] = [];
    for (const item of timeItems) {
      if (!isEnabled(item, current)) continue;
      const { value, error } = readTime(parts[item.linkId]);
      current = setAnswer(current, item.linkId, value);
      if (error) entryErrors.push({ linkId: item.linkId, code: error });
    }
    updateDraft(draft => ({ ...draft, answers: current }));
    // Required and cross-field checks come from the Questionnaire model once each time is readable.
    const enteredIds = new Set(entryErrors.map(error => error.linkId));
    const found = [...entryErrors, ...validatePage(group, current).filter(error => !enteredIds.has(error.linkId))];
    found.sort((a, b) => timeItems.findIndex(item => item.linkId === a.linkId) - timeItems.findIndex(item => item.linkId === b.linkId));
    setErrors(found);
    setAttempt(count => count + 1);
    if (!found.length) next(screen, nextScreen);
  };

  const timeQuestion = (item: QuestionnaireItem, headingLevel: 'm' | 's') => (isEnabled(item, answers)
    ? <TimeInput key={item.linkId} item={item} parts={parts[item.linkId]} error={errorFor(item.linkId)} headingLevel={headingLevel} onChange={next => changeTime(item.linkId, next)} />
    : null);

  const booleanCheckbox = (item: QuestionnaireItem) => (
    <div className="nhsuk-checkboxes nhsuk-checkboxes--small" key={item.linkId}>
      <div className="nhsuk-checkboxes__item">
        <input className="nhsuk-checkboxes__input" id={item.linkId} name={item.linkId} type="checkbox" checked={answers[item.linkId] === true} onChange={event => update(item.linkId, event.target.checked)} />
        <label className="nhsuk-label nhsuk-checkboxes__label" htmlFor={item.linkId}><QText item={item} /></label>
      </div>
    </div>
  );

  // A meal: its time question, then the "I do not usually eat this meal" option.
  const mealGroup = (item: QuestionnaireItem) => {
    const children = item.item ?? [];
    const time = children.find(child => child.type === 'time');
    const skip = children.find(child => child.type === 'boolean' && itemControl(child) === 'check-box');
    return (
      <section className="app-meal" key={item.linkId} aria-labelledby={`${item.linkId}-heading`}>
        <h2 className="nhsuk-heading-m app-meal__heading" id={`${item.linkId}-heading`}><QText item={item} /></h2>
        {time && timeQuestion(time, 's')}
        {time && skip && isEnabled(time, answers) && <p className="app-or">{t('common.or')}</p>}
        {skip && booleanCheckbox(skip)}
      </section>
    );
  };

  return (
    <>
      <BackLink to={back(screen, previous)} />
      <ErrorSummary attempt={attempt} errors={errors.map(error => ({ href: `#${errorTarget(error)}`, text: t(errorKey(error)) }))} />
      <PageHeading caption={<Caption />}><QText item={group} /></PageHeading>
      {(group.item ?? []).map(item => {
        if (isInstructions(item)) return <p className="nhsuk-body" key={item.linkId}><QText item={item} /></p>;
        if (item.type === 'time') return timeQuestion(item, 'm');
        if (item.type === 'group') return mealGroup(item);
        return null;
      })}
      <Button onClick={submit}><T k="common.continue" /></Button>
    </>
  );
}
