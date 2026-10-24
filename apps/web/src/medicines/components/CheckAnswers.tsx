'use client';

import { useState, type ReactNode } from 'react';
import { DEMO_RECORD, MEALS, toRoutine } from '@hackathon/medicines';
import { useJourney } from '../context';
import type { MessageKey } from '../i18n';
import type { ChangeFlow, Screen } from '../state';
import { proposalFor } from '../state';
import { BackLink, Button, Caption, Entered, ErrorSummary, Latin, PageHeading, T, Tag, Time } from './ui';
import { MedicineName } from './MedicineScreens';

function Row({ label, children, change }: { label: ReactNode; children: ReactNode; change?: { flow: ChangeFlow; hidden: MessageKey } }) {
  const { startChange, t } = useJourney();
  return (
    <div className="nhsuk-summary-list__row">
      <dt className="nhsuk-summary-list__key">{label}</dt>
      <dd className="nhsuk-summary-list__value">{children}</dd>
      {change && (
        <dd className="nhsuk-summary-list__actions">
          <a href={`#${change.flow.start}`} onClick={event => { event.preventDefault(); startChange(change.flow); }}>
            <T k="common.change" /><span className="nhsuk-u-visually-hidden"> {t(change.hidden)}</span>
          </a>
        </dd>
      )}
    </div>
  );
}

const flow = (start: Screen, end: Screen = start): ChangeFlow => ({ start, end, origin: 'check' });

export function CheckAnswers() {
  const { state, go, t } = useJourney();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { draft } = state;
  const routine = toRoutine(draft.answers);
  const included = DEMO_RECORD.filter(medicine => draft.selected.includes(medicine.id));
  const excluded = DEMO_RECORD.filter(medicine => !draft.selected.includes(medicine.id));

  const create = () => {
    setAttempt(count => count + 1);
    if (!included.length && !draft.additions.length) { setError(true); return; }
    setError(false);
    go('proposal', { proposal: proposalFor(draft), changeFlow: undefined });
  };

  const list = (items: { id: string; name: ReactNode }[]) => (items.length
    ? <ul className="nhsuk-list app-plain-list">{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>
    : <T k="common.none" />);

  return (
    <>
      <BackLink to="additions" />
      <ErrorSummary attempt={attempt} errors={error ? [{ href: '#check-record', text: t('check.errorNothing') }] : []} />
      <PageHeading caption={<Caption />}><T k="check.title" /></PageHeading>

      <h2 className="nhsuk-heading-m"><T k="check.routine" /></h2>
      <dl className="nhsuk-summary-list">
        <Row label={<T k="check.wake" />} change={{ flow: flow('waking-sleeping'), hidden: 'check.changeWaking' }}>{routine && <Time value={routine.wake} />}</Row>
        <Row label={<T k="check.sleep" />}>{routine && <Time value={routine.sleep} />}</Row>
        {MEALS.map((meal, index) => (
          <Row key={meal} label={<T k={`meals.${meal}`} />} change={index === 0 ? { flow: flow('meal-times'), hidden: 'check.changeMeals' } : undefined}>
            {routine && (routine.meals[meal] ? <Time value={routine.meals[meal]!} /> : <T k="check.skipped" />)}
          </Row>
        ))}
      </dl>

      <h2 className="nhsuk-heading-m" id="check-record" tabIndex={-1}><T k="check.record" /></h2>
      <dl className="nhsuk-summary-list">
        <Row label={<T k="check.included" />} change={{ flow: flow('medicines'), hidden: 'check.changeRecord' }}>
          {list(included.map(medicine => ({ id: medicine.id, name: <MedicineName name={medicine.name} strength={medicine.strength} /> })))}
        </Row>
        <Row label={<T k="check.notIncluded" />}>
          {list(excluded.map(medicine => ({ id: medicine.id, name: <MedicineName name={medicine.name} strength={medicine.strength} /> })))}
        </Row>
      </dl>

      <h2 className="nhsuk-heading-m"><T k="check.added" /></h2>
      <dl className="nhsuk-summary-list">
        <Row label={<T k="common.addedByYou" />} change={{ flow: flow('additions'), hidden: 'check.changeAdded' }}>
          {list(draft.additions.map(addition => ({
            id: addition.id,
            name: <>{addition.productId ? <Latin>{addition.name} {addition.strength}</Latin> : <><Entered>{addition.name}</Entered>{addition.strength && <> <Entered>{addition.strength}</Entered></>}</>}{' – '}<Entered>{addition.doseText}</Entered>, <T k={`frequencies.${addition.frequency}`} />{!addition.productId && <> <Tag colour="orange"><T k="common.notMatched" /></Tag></>}</>,
          })))}
        </Row>
      </dl>

      <Button onClick={create}><T k="check.create" /></Button>
    </>
  );
}
