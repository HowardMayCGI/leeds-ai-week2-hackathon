'use client';

import { useState, type ReactNode } from 'react';
import {
  hintFor, isEnabled, isInstructions, itemControl, itemText, setAnswer, validatePage,
  type FieldError, type QuestionnaireItem,
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

function errorKey(error: FieldError): MessageKey {
  switch (error.code) {
    case 'required': return `routine.errors.required.${error.linkId}` as MessageKey;
    case 'invalid-time': return 'routine.errors.invalidTime';
    case 'sleep-same-as-wake': return 'routine.errors.sleepSameAsWake';
    case 'meal-outside-waking-day': return `routine.errors.outsideDay.${error.meal}`;
    case 'meals-out-of-order': return `routine.errors.outOfOrder.${error.meal}`;
  }
}

/**
 * Renders one top-level Questionnaire group as a screen. Question text, hints
 * and conditional display all come from the Questionnaire resource.
 */
export function RoutineScreen({ group, previous, nextScreen }: { group: QuestionnaireItem; previous: Screen; nextScreen: Screen }) {
  const { state, t, updateDraft, next, back } = useJourney();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const answers = state.draft.answers;
  const screen = group.linkId as Screen;
  const errorFor = (linkId: string) => errors.find(error => error.linkId === linkId);

  const update = (linkId: string, value: string | boolean | undefined) => {
    updateDraft(draft => ({ ...draft, answers: setAnswer(draft.answers, linkId, value) }));
    if (errorFor(linkId)) setErrors(current => current.filter(error => error.linkId !== linkId));
  };

  const submit = () => {
    const found = validatePage(group, answers);
    setErrors(found);
    setAttempt(count => count + 1);
    if (!found.length) next(screen, nextScreen);
  };

  const timeQuestion = (item: QuestionnaireItem, labelClass: string, wrap?: (label: ReactNode) => ReactNode) => {
    if (!isEnabled(item, answers)) return null;
    const hint = hintFor(item);
    const error = errorFor(item.linkId);
    const described = [hint && `${item.linkId}-hint`, error && `${item.linkId}-error`].filter(Boolean).join(' ') || undefined;
    const label = <label className={`nhsuk-label ${labelClass}`} htmlFor={item.linkId}><QText item={item} /></label>;
    return (
      <div className={`nhsuk-form-group${error ? ' nhsuk-form-group--error' : ''}`} key={item.linkId}>
        {wrap ? wrap(label) : label}
        {hint && <div className="nhsuk-hint" id={`${item.linkId}-hint`}><QText item={hint} /></div>}
        {error && <ErrorMessage id={`${item.linkId}-error`}><T k={errorKey(error)} /></ErrorMessage>}
        <input
          className={`nhsuk-input nhsuk-input--width-5 app-time-input${error ? ' nhsuk-input--error' : ''}`}
          id={item.linkId}
          name={item.linkId}
          type="time"
          dir="ltr"
          value={typeof answers[item.linkId] === 'string' ? answers[item.linkId] as string : ''}
          aria-describedby={described}
          onChange={event => update(item.linkId, event.target.value || undefined)}
        />
      </div>
    );
  };

  const booleanCheckbox = (item: QuestionnaireItem) => (
    <div className="nhsuk-checkboxes nhsuk-checkboxes--small" key={item.linkId}>
      <div className="nhsuk-checkboxes__item">
        <input className="nhsuk-checkboxes__input" id={item.linkId} name={item.linkId} type="checkbox" checked={answers[item.linkId] === true} onChange={event => update(item.linkId, event.target.checked)} />
        <label className="nhsuk-label nhsuk-checkboxes__label" htmlFor={item.linkId}><QText item={item} /></label>
      </div>
    </div>
  );

  // A meal group: its time question, then the "I do not usually eat this meal" option.
  const mealGroup = (item: QuestionnaireItem) => {
    const children = item.item ?? [];
    const time = children.find(child => child.type === 'time');
    const skip = children.find(child => child.type === 'boolean' && itemControl(child) === 'check-box');
    return (
      <fieldset className="nhsuk-fieldset app-meal" key={item.linkId}>
        <legend className="nhsuk-fieldset__legend nhsuk-fieldset__legend--m"><h2 className="nhsuk-fieldset__heading"><QText item={item} /></h2></legend>
        {time && timeQuestion(time, 'nhsuk-label--s')}
        {time && skip && isEnabled(time, answers) && <p className="app-or">{t('common.or')}</p>}
        {skip && booleanCheckbox(skip)}
      </fieldset>
    );
  };

  return (
    <>
      <BackLink to={back(screen, previous)} />
      <ErrorSummary attempt={attempt} errors={errors.map(error => ({ href: `#${error.linkId}`, text: t(errorKey(error)) }))} />
      <PageHeading caption={<Caption />}><QText item={group} /></PageHeading>
      {(group.item ?? []).map(item => {
        if (isInstructions(item)) return <p className="nhsuk-body" key={item.linkId}><QText item={item} /></p>;
        if (item.type === 'time') return timeQuestion(item, 'nhsuk-label--m', label => <h2 className="nhsuk-label-wrapper">{label}</h2>);
        if (item.type === 'group') return mealGroup(item);
        return null;
      })}
      <Button onClick={submit}><T k="common.continue" /></Button>
    </>
  );
}
