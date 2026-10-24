'use client';

import type { ReactNode } from 'react';
import { buildResponse, dayTimeline, type DoseNote, type ItemSnapshot, type Problem, type Proposal, type RoutineEvent } from '@hackathon/medicines';
import { useJourney } from '../context';
import type { MessageKey } from '../i18n';
import type { SavedSchedule } from '../state';
import { RemindersPanel, ReminderSummary } from './Reminders';
import { BackLink, Button, Caption, DoseAmount, Entered, InsetText, Latin, NavLink, PageHeading, RecordText, T, Tag, Time, TName } from './ui';

type OkProposal = Extract<Proposal, { status: 'ok' }>;

function ItemName({ item }: { item: ItemSnapshot }) {
  return item.matched ? <Latin>{item.name}{item.strength ? ` ${item.strength}` : ''}</Latin> : <Entered>{item.name}</Entered>;
}

function ItemDose({ item }: { item: ItemSnapshot }) {
  return item.dose ? <DoseAmount dose={item.dose} strength={item.strength} entered={!item.matched} /> : <T k="record.doseMissing" />;
}

function ItemFrequency({ item }: { item: ItemSnapshot }) {
  if (item.everyDays) return <T k="record.everyDays" params={{ count: item.everyDays }} />;
  return item.frequency ? <T k={`frequencies.${item.frequency}`} /> : <T k="record.frequencyMissing" />;
}

/** Item-supplied text: record wording as recorded, patient wording as entered. */
function ItemText({ item, text }: { item: ItemSnapshot; text: string }) {
  return item.source === 'record' ? <RecordText text={text} language={item.language} /> : <Entered>{text}</Entered>;
}

function Note({ note, items }: { note: DoseNote; items: ItemSnapshot[] }) {
  switch (note.code) {
    case 'with-meal': return <T k={`notes.withMeal.${note.meal}`} />;
    case 'at-meal-time': return <T k={`notes.atMealTime.${note.meal}`} />;
    case 'before-meal': return <T k={`notes.beforeMeal.${note.meal}`} params={{ minutes: note.minutes }} />;
    case 'empty-stomach': return <T k="notes.emptyStomach" />;
    case 'on-waking': return <T k="notes.onWaking" />;
    case 'at-bedtime': return <T k="notes.atBedtime" />;
    case 'in-evening': return <T k="notes.inEvening" />;
    case 'before-others': return <T k="notes.beforeOthers" params={{ minutes: note.minutes }} />;
    case 'apart-from': {
      const other = items.find(item => item.key === note.key);
      return <T k="notes.apartFrom" params={{ hours: note.hours, name: other?.name ?? '' }} />;
    }
  }
}

function DoseDetails({ item }: { item: ItemSnapshot }) {
  const { lang } = useJourney();
  const untranslated = item.source === 'record' && lang !== (item.language ?? 'en');
  const row = (label: MessageKey, value: ReactNode) => (
    <div className="nhsuk-summary-list__row">
      <dt className="nhsuk-summary-list__key"><T k={label} /></dt>
      <dd className="nhsuk-summary-list__value">{value}</dd>
    </div>
  );
  return (
    <details className="nhsuk-details app-dose-details">
      <summary className="nhsuk-details__summary"><span className="nhsuk-details__summary-text"><T k="schedule.details" /><span className="nhsuk-u-visually-hidden">: {item.name}</span></span></summary>
      <div className="nhsuk-details__text">
        <dl className="nhsuk-summary-list app-compact-summary">
          {row('common.dose', <ItemDose item={item} />)}
          {row('common.howOften', <ItemFrequency item={item} />)}
          {item.timing && row('common.whenTaken', <T k={`timings.${item.timing}`} />)}
          {item.instructions.length > 0 && row('common.instructions', <>{item.instructions.map(text => <span className="app-block" key={text}><ItemText item={item} text={text} /></span>)}</>)}
          {item.recordName && row('schedule.recordedAs', <RecordText text={item.recordName} />)}
          {row('common.source', <T k={item.source === 'patient' ? 'common.addedByYou' : 'common.fromRecord'} />)}
        </dl>
        {untranslated && <p className="app-untranslated"><T k="common.inEnglish" /></p>}
      </div>
    </details>
  );
}

function Dose({ item, notes, items }: { item: ItemSnapshot; notes: DoseNote[]; items: ItemSnapshot[] }) {
  return (
    <li className="app-dose">
      <h3 className="app-dose__name"><ItemName item={item} /></h3>
      <p className="app-dose__amount"><ItemDose item={item} />
        {item.source === 'patient' && <> <Tag colour="blue"><T k="common.addedByYou" /></Tag></>}
      </p>
      {notes.length > 0 && <ul className="app-dose__notes">{notes.map((note, index) => <li key={index}><Note note={note} items={items} /></li>)}</ul>}
      {item.timingFlag && (
        <div className="app-dose__flag">
          <p className="app-tags"><Tag colour="orange"><T k="flag.tag" /></Tag></p>
          <p><TName k={`flag.schedule.${item.timingFlag.recommended}`} name={item.name} /></p>
        </div>
      )}
      {!item.matched && <p className="app-dose__reason"><T k="proposal.unmatched" /></p>}
      <DoseDetails item={item} />
    </li>
  );
}

function EventLabel({ events }: { events: RoutineEvent[] }) {
  return <>{events.map((event, index) => <span key={event}>{index > 0 && ', '}<T k={`schedule.events.${event}`} /></span>)}</>;
}

/**
 * The schedule as an NHS App timeline of the patient's day: waking up, meals
 * and going to sleep, with each time's medicines. Times with medicines have a
 * large marker; parts of the day without medicines have a small one.
 */
export function Timeline({ proposal }: { proposal: OkProposal }) {
  const items = proposal.items;
  const byKey = new Map(items.map(item => [item.key, item]));
  const entries = dayTimeline(proposal.routine, proposal.doses);
  return (
    <>
      {!proposal.doses.length && <p className="nhsuk-body"><T k="proposal.noTimes" /></p>}
      <ol className="nhsapp-timeline app-timeline">
        {entries.map(entry => {
          const hasDoses = entry.doses.length > 0;
          return (
            <li className={`nhsapp-timeline__item${hasDoses ? ' app-timeline__item--doses' : ''}`} key={entry.minute}>
              {hasDoses ? (
                <svg className="nhsapp-timeline__badge" aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="#005EB8" /></svg>
              ) : (
                <svg className="nhsapp-timeline__badge nhsapp-timeline__badge--small" aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="white" stroke="#AEB7BD" strokeWidth="2" /></svg>
              )}
              <div className="nhsapp-timeline__content">
                <h2 className={`nhsapp-timeline__header app-timeline__time${hasDoses ? ' nhsuk-u-font-weight-bold' : ''}`}>
                  <Time value={entry.time} />
                  {entry.events.length > 0 && <span className="app-timeline__event"><EventLabel events={entry.events} /></span>}
                </h2>
                {hasDoses && (
                  <ul className="app-timeline__doses">
                    {entry.doses.map(dose => <Dose key={`${dose.key}-${dose.minute}`} item={byKey.get(dose.key)!} notes={dose.notes} items={items} />)}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {proposal.whenNeeded.length > 0 && (
        <section className="app-when-needed" aria-labelledby="when-needed-title">
          <h2 className="nhsuk-heading-m" id="when-needed-title"><T k="proposal.whenNeededTitle" /></h2>
          <p className="nhsuk-body"><T k="proposal.whenNeededBody" /></p>
          <ul className="app-timeline__doses">
            {proposal.whenNeeded.map(key => <Dose key={key} item={byKey.get(key)!} notes={[]} items={items} />)}
          </ul>
        </section>
      )}
      {proposal.notDaily.length > 0 && (
        <section className="app-when-needed" aria-labelledby="not-daily-title">
          <h2 className="nhsuk-heading-m" id="not-daily-title"><T k="proposal.notDailyTitle" /></h2>
          <p className="nhsuk-body"><T k="proposal.notDailyBody" /></p>
          <ul className="app-timeline__doses">
            {proposal.notDaily.map(key => <Dose key={key} item={byKey.get(key)!} notes={[]} items={items} />)}
          </ul>
        </section>
      )}
      {(proposal.unscheduled ?? []).length > 0 && (
        <section className="app-when-needed" aria-labelledby="unscheduled-title">
          <h2 className="nhsuk-heading-m" id="unscheduled-title"><T k="proposal.unscheduledTitle" /></h2>
          <p className="nhsuk-body"><T k="proposal.unscheduledBody" /></p>
          <ul className="app-timeline__doses">
            {proposal.unscheduled.map(key => <Dose key={key} item={byKey.get(key)!} notes={[]} items={items} />)}
          </ul>
        </section>
      )}
    </>
  );
}

function ProblemText({ problem, items }: { problem: Problem; items: ItemSnapshot[] }) {
  const name = (key: string) => items.find(item => item.key === key)?.name ?? '';
  switch (problem.code) {
    case 'cannot-separate': return <T k="proposal.problems.cannot-separate" params={{ first: name(problem.keys[0]), second: name(problem.keys[1]), hours: problem.hours }} />;
    case 'cannot-take-first': return <T k="proposal.problems.cannot-take-first" params={{ first: name(problem.keys[0]), second: name(problem.keys[1]), minutes: problem.minutes }} />;
    case 'too-complex': return <T k="proposal.problems.too-complex" />;
    case 'not-enough-meals': return <T k="proposal.problems.not-enough-meals" params={{ name: name(problem.key), doses: problem.doses }} />;
    case 'not-enough-time': return <T k="proposal.problems.not-enough-time" params={{ name: name(problem.key), doses: problem.doses, hours: problem.hours }} />;
    default: return <T k={`proposal.problems.${problem.code}`} params={{ name: name(problem.key) }} />;
  }
}

export function ProposalScreen() {
  const { state, go, setState, startChange, lang } = useJourney();
  const proposal = state.proposal;
  if (!proposal) return null;
  const changeRoutine = () => startChange({ start: 'waking-sleeping', end: 'meal-times', origin: 'proposal' });

  if (proposal.status === 'blocked') {
    return (
      <>
        <BackLink to="check" />
        <PageHeading caption={<Caption />}><T k="proposal.blockedTitle" /></PageHeading>
        <p className="nhsuk-body-l"><T k="proposal.blockedLede" /></p>
        <div className="nhsuk-error-summary app-problems" aria-labelledby="problems-title">
          <h2 className="nhsuk-error-summary__heading nhsuk-u-visually-hidden" id="problems-title"><T k="common.errorSummaryTitle" /></h2>
          <ul className="nhsuk-list nhsuk-list--bullet">
            {proposal.problems.map((problem, index) => <li key={index}><ProblemText problem={problem} items={proposal.items} /></li>)}
          </ul>
        </div>
        <h2 className="nhsuk-heading-m"><T k="proposal.whatYouCanDo" /></h2>
        <ul className="nhsuk-list nhsuk-list--bullet">
          <li><T k="proposal.canChangeRoutine" /></li>
          <li><T k="proposal.canChangeMedicines" /></li>
          <li><T k="proposal.canAskPharmacist" /></li>
        </ul>
        {state.updating && <InsetText><p><T k="proposal.savedUnchanged" /></p></InsetText>}
        <Button onClick={changeRoutine}><T k="proposal.changeRoutine" /></Button>
        <p><NavLink onClick={() => startChange({ start: 'medicines', end: 'additions', origin: 'proposal' })}><T k="proposal.changeMedicines" /></NavLink></p>
        {state.updating && <p><NavLink onClick={() => go('schedule', { updating: false, proposal: undefined })}><T k="proposal.keepSaved" /></NavLink></p>}
      </>
    );
  }

  const save = () => {
    setState(current => {
      const saved: SavedSchedule = {
        version: 3,
        savedAt: new Date().toISOString(),
        draft: current.draft,
        response: buildResponse(current.draft.answers, new Date().toISOString(), lang),
        proposal,
        // The reminder preference and device permission carry over; a review request was for the old schedule.
        reminders: current.saved?.reminders ?? { enabled: true, permission: 'not-requested' },
      };
      return { ...current, saved, screen: 'saved-confirmation', proposal: undefined, updating: false, changeFlow: undefined };
    });
  };

  return (
    <>
      <BackLink to="check" />
      <PageHeading caption={<Caption />}><T k={state.updating ? 'proposal.titleUpdate' : 'proposal.title'} /></PageHeading>
      <p className="app-tags"><Tag colour="yellow"><T k="proposal.tag" /></Tag></p>
      <p className="nhsuk-body"><T k="proposal.lede" /></p>
      {state.updating && <InsetText><p><T k="proposal.updateInset" /></p></InsetText>}
      <p className="nhsuk-body"><T k="proposal.basis" /></p>
      <Timeline proposal={proposal} />
      <div className="app-actions">
        <Button onClick={save}><T k="proposal.save" /></Button>
        <Button secondary onClick={changeRoutine}><T k="proposal.changeRoutine" /></Button>
      </div>
      {state.updating && <p><NavLink onClick={() => go('schedule', { updating: false, proposal: undefined })}><T k="proposal.keepSaved" /></NavLink></p>}
    </>
  );
}

export function SavedConfirmation() {
  const { go } = useJourney();
  return (
    <>
      <div className="nhsuk-notification-banner nhsuk-notification-banner--success" role="alert" aria-labelledby="saved-banner-title">
        <div className="nhsuk-notification-banner__header">
          <h2 className="nhsuk-notification-banner__title" id="saved-banner-title"><T k="saved.bannerTitle" /></h2>
        </div>
        <div className="nhsuk-notification-banner__content">
          <h1 className="nhsuk-notification-banner__heading" id="page-heading" tabIndex={-1}><T k="saved.bannerHeading" /></h1>
          <p className="nhsuk-body"><T k="saved.bannerBody" /></p>
        </div>
      </div>
      <RemindersPanel headingLevel={2} />
      <Button onClick={() => go('schedule')}><T k="saved.view" /></Button>
    </>
  );
}

export function SavedScheduleScreen() {
  const { state, date, setState, startChange } = useJourney();
  const saved = state.saved;
  if (!saved) return null;
  const beginUpdate = (start: 'waking-sleeping' | 'medicines', end: 'meal-times' | 'additions') => {
    // Work on a copy; the saved schedule stays in use until a replacement is saved.
    setState(current => ({ ...current, draft: structuredClone(saved.draft), updating: true, proposal: undefined }));
    startChange({ start, end, origin: 'schedule' });
  };
  const requestReview = () => {
    setState(current => (current.saved ? { ...current, saved: { ...current.saved, reviewRequestedAt: new Date().toISOString() }, screen: 'review-confirmation' } : current));
  };
  return (
    <>
      <BackLink to="prescriptions" />
      <PageHeading caption={<Caption />}><T k="savedSchedule.title" /></PageHeading>
      <p className="app-tags"><Tag colour="green"><T k="savedSchedule.tag" /></Tag> <span className="app-small-print"><T k="savedSchedule.savedOn" params={{ date: date(saved.savedAt) }} /></span></p>
      <p className="nhsuk-body"><T k="savedSchedule.useNow" /></p>
      <Timeline proposal={saved.proposal} />

      <div className="nhsuk-card app-panel">
        <div className="nhsuk-card__content">
          <h2 className="nhsuk-card__heading nhsuk-heading-m"><T k="savedSchedule.remindersTitle" /></h2>
          <ReminderSummary />
          <p><NavLink to="reminders"><T k="savedSchedule.manage" /></NavLink></p>
        </div>
      </div>

      <div className="nhsuk-card app-panel">
        <div className="nhsuk-card__content">
          <h2 className="nhsuk-card__heading nhsuk-heading-m"><T k="savedSchedule.reviewTitle" /></h2>
          <p className="nhsuk-card__description"><T k="savedSchedule.reviewBody" /></p>
          {saved.reviewRequestedAt
            ? <p className="app-tags"><Tag colour="purple"><T k="review.tag" /></Tag> <T k="savedSchedule.reviewRequested" params={{ date: date(saved.reviewRequestedAt) }} /></p>
            : <Button secondary onClick={requestReview} className="nhsuk-u-margin-bottom-0"><T k="savedSchedule.reviewButton" /></Button>}
        </div>
      </div>

      <div className="nhsuk-card app-panel">
        <div className="nhsuk-card__content">
          <h2 className="nhsuk-card__heading nhsuk-heading-m"><T k="savedSchedule.changesTitle" /></h2>
          <p className="nhsuk-card__description"><T k="savedSchedule.changesBody" /></p>
          <ul className="nhsuk-list app-link-list">
            <li><NavLink onClick={() => beginUpdate('waking-sleeping', 'meal-times')}><T k="savedSchedule.changeRoutine" /></NavLink></li>
            <li><NavLink onClick={() => beginUpdate('medicines', 'additions')}><T k="savedSchedule.changeMedicines" /></NavLink></li>
          </ul>
        </div>
      </div>
    </>
  );
}

export function ReviewConfirmation() {
  const { go } = useJourney();
  return (
    <>
      <p className="app-tags"><Tag colour="purple"><T k="review.tag" /></Tag></p>
      <PageHeading><T k="review.title" /></PageHeading>
      <p className="nhsuk-body-l"><T k="review.body" /></p>
      <p className="nhsuk-body"><T k="review.keepUsing" /></p>
      <Button onClick={() => go('schedule')}><T k="review.back" /></Button>
    </>
  );
}

export function RemindersScreen() {
  const { go } = useJourney();
  return (
    <>
      <BackLink to="schedule" />
      <PageHeading caption={<Caption />}><T k="reminders.title" /></PageHeading>
      <RemindersPanel headingLevel={null} />
      <Button onClick={() => go('schedule')}><T k="reminders.done" /></Button>
    </>
  );
}
