'use client';

import { useEffect, useState } from 'react';
import type { SelectedMedicine, SelectionInteractionsResponse } from '@hackathon/api-contract';
import type { ItemSnapshot, Proposal, RecordMedicine } from '@hackathon/medicines';
import { checkInteractions } from '../ai-client';
import { useJourney } from '../context';
import { gapMet, itemLabel, type Interaction } from '../facts';
import { InsetText, Latin, LinkButton, T, TNodes, WarningCallout } from './ui';

type OkProposal = Extract<Proposal, { status: 'ok' }>;
export type InteractionCheck = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: SelectionInteractionsResponse };

/** The schedule's medicines as the interaction rules know them: by product code, under the app's own keys. */
export function selectedMedicines(items: ItemSnapshot[], record: RecordMedicine[]): SelectedMedicine[] {
  return items.map(item => {
    // A schedule saved before product codes were kept finds them in the record.
    const recorded = !item.code && item.source === 'record' ? record.find(medicine => `record:${medicine.id}` === item.key)?.medicine : undefined;
    const code = item.code ?? recorded?.code;
    const system = item.system ?? recorded?.system;
    return { id: item.key, name: itemLabel(item), ...(code ? { code } : {}), ...(system ? { system } : {}) };
  });
}

/** Checks the schedule's medicines against each other, once per set of medicines for the visit. */
export function useInteractions(items: ItemSnapshot[]): { check: InteractionCheck; retry: () => void } {
  const { record } = useJourney();
  const [attempt, setAttempt] = useState(0);
  const [check, setCheck] = useState<InteractionCheck>({ status: 'loading' });
  const request = JSON.stringify(selectedMedicines(items, record));
  useEffect(() => {
    let current = true;
    setCheck({ status: 'loading' });
    checkInteractions(JSON.parse(request) as SelectedMedicine[]).then(
      value => { if (current) setCheck({ status: 'ready', value }); },
      () => { if (current) setCheck({ status: 'error' }); },
    );
    return () => { current = false; };
  }, [request, attempt]);
  return { check, retry: () => setAttempt(count => count + 1) };
}

/** Two medicine names placed in translated text, each kept in Latin script. */
function Pair({ k, first, second, params }: { k: 'interactions.pair' | 'interactions.apart'; first: string; second: string; params?: Record<string, number> }) {
  return <TNodes k={k} nodes={{ first: <Latin>{first}</Latin>, second: <Latin>{second}</Latin> }} params={params} />;
}

/**
 * Warnings for medicines in the schedule that the interaction rules say a GP
 * or pharmacist should check. Nothing is shown when there are no matches,
 * because no match never means the medicines are safe together.
 */
export function InteractionWarnings({ proposal, check, retry }: { proposal: OkProposal; check: InteractionCheck; retry: () => void }) {
  const { lang } = useJourney();
  if (check.status === 'loading') return <p className="nhsuk-u-visually-hidden" role="status"><T k="interactions.checking" /></p>;
  if (check.status === 'error') {
    return (
      <InsetText>
        <p><T k="interactions.error" /> <T k="interactions.limits" /></p>
        <p><LinkButton onClick={retry}><T k="interactions.retry" /></LinkButton></p>
      </InsetText>
    );
  }
  const name = (key: string) => {
    const item = proposal.items.find(candidate => candidate.key === key);
    return item ? itemLabel(item) : '';
  };
  const matches = check.value.interactions.filter(match => match.medicineIds.every(key => proposal.items.some(item => item.key === key)));
  const met = matches.filter(match => gapMet(match, proposal));
  const toCheck = matches.filter(match => !gapMet(match, proposal));
  const hours = (match: Interaction) => (match.minimumGapMinutes ?? 0) / 60;
  return (
    <>
      {toCheck.length > 0 && (
        <div className="app-interactions" data-testid="interaction-warnings">
          <WarningCallout heading={<T k="interactions.title" />}>
            <p className="nhsuk-body"><T k="interactions.lede" /></p>
            <ul className="app-interactions__list">
              {toCheck.map(match => (
                <li className="app-interactions__item" key={match.id}>
                  <h3 className="nhsuk-heading-s app-interactions__names"><Pair k="interactions.pair" first={name(match.medicineIds[0])} second={name(match.medicineIds[1])} /></h3>
                  <p className="nhsuk-body"><T k={`interactions.action.${match.action}`} params={{ hours: hours(match) }} /></p>
                  <details className="nhsuk-details app-interactions__details">
                    <summary className="nhsuk-details__summary">
                      <span className="nhsuk-details__summary-text"><T k="interactions.details" /><span className="nhsuk-u-visually-hidden">: {name(match.medicineIds[0])}, {name(match.medicineIds[1])}</span></span>
                    </summary>
                    <div className="nhsuk-details__text">
                      <p lang="en" dir="ltr">{match.effect} {match.patientGuidance}</p>
                      {lang !== 'en' && <p className="app-untranslated"><T k="common.englishOnly" /></p>}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <p className="nhsuk-body"><T k="interactions.keepTaking" /></p>
            <p className="nhsuk-body-s nhsuk-u-margin-bottom-0"><T k="interactions.limits" /></p>
          </WarningCallout>
        </div>
      )}
      {met.map(match => (
        <InsetText key={match.id}>
          <p><Pair k="interactions.apart" first={name(match.medicineIds[0])} second={name(match.medicineIds[1])} params={{ hours: hours(match) }} /></p>
        </InsetText>
      ))}
    </>
  );
}
