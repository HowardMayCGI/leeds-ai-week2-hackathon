'use client';

import type { ReactNode } from 'react';
import { buildResponse, groupByTime, type DoseNote, type ItemSnapshot, type Problem, type Proposal } from '@hackathon/medicines';
import { useJourney } from '../context';
import type { MessageKey } from '../i18n';
import type { SavedSchedule } from '../state';
import { RemindersPanel, ReminderSummary } from './Reminders';
import { BackLink, Button, Caption, Entered, InsetText, Latin, NavLink, PageHeading, RecordText, T, Tag, Time } from './ui';

type OkProposal = Extract<Proposal, { status: 'ok' }>;

function ItemName({ item }: { item: ItemSnapshot }) {
  return item.source === 'record' || item.productId
    ? <Latin>{item.name}{item.strength ? ` ${item.strength}` : ''}</Latin>
    : <><Entered>{item.name}</Entered>{item.strength && <> <Entered>{item.strength}</Entered></>}</>;
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
          {row('common.dose', <ItemText item={item} text={item.doseText} />)}
          {row('common.howOften', item.frequencyText ? <ItemText item={item} text={item.frequencyText} /> : <T k={`frequencies.${item.frequency!}`} />)}
          {item.instructionText && row('common.instructions', <ItemText item={item} text={item.instructionText} />)}
          {row('common.source', <T k={item.source === 'record' ? 'common.fromRecord' : 'common.addedByYou'} />)}
        </dl>
        {untranslated && <p className="app-untranslated"><T k="common.inEnglish" /></p>}
      </div>
    </details>
  );
}

export function Timeline({ proposal }: { proposal: OkProposal }) {
  const { lang } = useJourney();
  const items = proposal.items;
  const byKey = new Map(items.map(item => [item.key, item]));
  const groups = groupByTime(proposal.doses);
  return (
    <>
      {groups.length ? (
        <ol className="app-timeline">
          {groups.map(group => (
            <li className="app-slot" key={group.minute}>
              <h2 className="app-slot__time"><Time value={group.time} /></h2>
              <ul className="app-slot__doses">
                {group.doses.map(dose => {
                  const item = byKey.get(dose.key)!;
                  return (
                    <li className="app-dose" key={`${dose.key}-${dose.minute}`}>
                      <h3 className="app-dose__name"><ItemName item={item} /></h3>
                      <p className="app-dose__amount"><ItemText item={item} text={item.doseText} />
                        {item.source === 'patient' && <> <Tag colour="blue"><T k="common.addedByYou" /></Tag></>}
                      </p>
                      {dose.notes.length > 0 && (
                        <ul className="app-dose__notes">{dose.notes.map((note, index) => <li key={index}><Note note={note} items={items} /></li>)}</ul>
                      )}
                      <DoseDetails item={item} />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      ) : <p className="nhsuk-body"><T k="proposal.noTimes" /></p>}
      {proposal.notTimed.length > 0 && (
        <section className="app-not-timed" aria-labelledby="not-timed-title">
          <h2 className="nhsuk-heading-s" id="not-timed-title"><T k="proposal.notTimedTitle" /></h2>
          <ul className="nhsuk-list">
            {proposal.notTimed.map(({ key, reason }) => {
              const item = byKey.get(key)!;
              return (
                <li className="app-dose" key={key}>
                  <h3 className="app-dose__name"><ItemName item={item} /></h3>
                  <p className="app-dose__amount"><ItemText item={item} text={item.doseText} /></p>
                  <p className="app-dose__reason"><T k={`proposal.notTimed.${reason}`} /></p>
                  <DoseDetails item={item} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p className="app-small-print" lang={lang}><T k="schedule.rulesNote" params={{ version: proposal.rulesVersion }} /></p>
    </>
  );
}

function ProblemText({ problem, items }: { problem: Problem; items: ItemSnapshot[] }) {
  const name = (key: string) => items.find(item => item.key === key)?.name ?? '';
  switch (problem.code) {
    case 'cannot-separate': return <T k="proposal.problems.cannot-separate" params={{ first: name(problem.keys[0]), second: name(problem.keys[1]), hours: problem.hours }} />;
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
        version: 1,
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
          {saved.reviewRequestedAt && <p className="app-tags"><Tag colour="purple"><T k="review.tag" /></Tag> <T k="savedSchedule.reviewRequested" params={{ date: date(saved.reviewRequestedAt) }} /></p>}
          <Button secondary onClick={requestReview} className="nhsuk-u-margin-bottom-0"><T k="savedSchedule.reviewButton" /></Button>
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
