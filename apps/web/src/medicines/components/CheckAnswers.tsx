'use client';

import { useState, type ReactNode } from 'react';
import { MEALS, needsDetails, toRoutine } from '@hackathon/medicines';
import { useJourney } from '../context';
import type { ChangeFlow, Screen, State } from '../state';
import { proposalFor } from '../state';
import { BackLink, Button, Caption, DoseAmount, ErrorSummary, NavLink, PageHeading, T, Tag, Time, TName } from './ui';
import { AdditionName, MedicineName, RecordFrequencyText, TimingValue } from './MedicineScreens';

/** A summary list row. Every answer has a Change link that returns here when done. */
function Row({ label, children, onChange, hidden }: { label: ReactNode; children: ReactNode; onChange: () => void; hidden: ReactNode }) {
  return (
    <div className="nhsuk-summary-list__row">
      <dt className="nhsuk-summary-list__key">{label}</dt>
      <dd className="nhsuk-summary-list__value">{children}</dd>
      <dd className="nhsuk-summary-list__actions">
        <NavLink onClick={onChange}><T k="common.change" /><span className="nhsuk-u-visually-hidden"> {hidden}</span></NavLink>
      </dd>
    </div>
  );
}

const flow = (start: Screen, end: Screen = start): ChangeFlow => ({ start, end, origin: 'check' });

export function CheckAnswers() {
  const { state, record, go, startChange, t } = useJourney();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { draft } = state;
  const routine = toRoutine(draft.answers);
  const included = record.filter(medicine => draft.selected.includes(medicine.id));
  const excluded = record.filter(medicine => !draft.selected.includes(medicine.id));
  const detailed = included.filter(medicine => needsDetails(medicine) && draft.recordDetails[medicine.id]);

  const create = () => {
    setAttempt(count => count + 1);
    if (!included.length && !draft.additions.length) { setError(true); return; }
    setError(false);
    go('proposal', { proposal: proposalFor(draft, record), changeFlow: undefined });
  };

  const changeAddition = (id?: string) => go('addition-form', { changeFlow: flow('addition-form'), editingAdditionId: id } satisfies Partial<State>);
  const changeDetails = (id: string) => go('record-details', { changeFlow: flow('record-details'), editingRecordId: id } satisfies Partial<State>);

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
        <Row label={<T k="check.wake" />} onChange={() => startChange(flow('waking-sleeping'))} hidden={<T k="check.changeWake" />}>
          {routine && <Time value={routine.wake} />}
        </Row>
        <Row label={<T k="check.sleep" />} onChange={() => startChange(flow('waking-sleeping'))} hidden={<T k="check.changeSleep" />}>
          {routine && <Time value={routine.sleep} />}
        </Row>
        {MEALS.map(meal => (
          <Row key={meal} label={<T k={`meals.${meal}`} />} onChange={() => startChange(flow('meal-times'))} hidden={<T k={`check.changeMeal.${meal}`} />}>
            {routine && (routine.meals[meal] ? <Time value={routine.meals[meal]!} /> : <T k="check.skipped" />)}
          </Row>
        ))}
      </dl>

      <h2 className="nhsuk-heading-m" id="check-record" tabIndex={-1}><T k="check.record" /></h2>
      <dl className="nhsuk-summary-list">
        <Row label={<T k="check.included" />} onChange={() => startChange(flow('medicines'))} hidden={<T k="check.changeIncluded" />}>
          {list(included.map(medicine => ({
            id: medicine.id,
            name: <>
              <MedicineName name={medicine.medicine.name} strength={medicine.medicine.strength} /><br />
              <span className="app-secondary-text">
                {medicine.dose && !draft.recordDetails[medicine.id] && <><DoseAmount dose={medicine.dose} strength={medicine.medicine.strength} />, </>}
                {draft.recordDetails[medicine.id] ? <T k="check.toldUs" /> : <RecordFrequencyText medicine={medicine} />}
              </span>
            </>,
          })))}
        </Row>
        <Row label={<T k="check.notIncluded" />} onChange={() => startChange(flow('medicines'))} hidden={<T k="check.changeNotIncluded" />}>
          {list(excluded.map(medicine => ({ id: medicine.id, name: <MedicineName name={medicine.medicine.name} strength={medicine.medicine.strength} /> })))}
        </Row>
      </dl>

      {detailed.length > 0 && (
        <>
          <h2 className="nhsuk-heading-m"><T k="check.details" /></h2>
          <dl className="nhsuk-summary-list">
            {detailed.map(medicine => {
              const details = draft.recordDetails[medicine.id];
              return (
                <Row key={medicine.id} label={<MedicineName name={medicine.medicine.name} strength={medicine.medicine.strength} />} onChange={() => changeDetails(medicine.id)}
                  hidden={<TName k="check.changeDetails" name={medicine.medicine.name} />}>
                  <DoseAmount dose={details.dose} strength={medicine.medicine.strength} />, <T k={`frequencies.${details.frequency}`} />
                </Row>
              );
            })}
          </dl>
        </>
      )}

      <h2 className="nhsuk-heading-m"><T k="check.added" /></h2>
      <dl className="nhsuk-summary-list">
        {draft.additions.length ? draft.additions.map(addition => (
          <Row key={addition.id} label={<AdditionName addition={addition} />} onChange={() => changeAddition(addition.id)} hidden={addition.name}>
            <DoseAmount dose={addition.dose} strength={addition.medicine?.strength ?? addition.strength} entered={!addition.medicine} />, <T k={`frequencies.${addition.frequency}`} />
            <br /><TimingValue addition={addition} />
            {!addition.medicine && <><br /><Tag colour="orange"><T k="common.notMatched" /></Tag></>}
          </Row>
        )) : (
          <Row label={<T k="common.addedByYou" />} onChange={() => startChange(flow('additions'))} hidden={<T k="check.changeAdded" />}>
            <T k="check.nothingAdded" />
          </Row>
        )}
      </dl>
      {draft.additions.length > 0 && <p><NavLink onClick={() => changeAddition(undefined)}><T k="check.addAnother" /></NavLink></p>}

      <Button onClick={create}><T k="check.create" /></Button>
    </>
  );
}
