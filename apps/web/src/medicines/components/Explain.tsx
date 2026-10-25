'use client';

import { useState } from 'react';
import type { Proposal } from '@hackathon/medicines';
import { explainSchedule } from '../ai-client';
import { useJourney } from '../context';
import { scheduleFacts } from '../facts';
import { languageInfo, type Language } from '../i18n';
import { LinkButton, T, Tag, useFocusLater } from './ui';

type OkProposal = Extract<Proposal, { status: 'ok' }>;

/** The doses a set of explanations is for, so they are never shown against different times. */
export function scheduleSignature(proposal: OkProposal): string {
  return proposal.doses.map(dose => `${dose.key}@${dose.minute}`).join('|');
}

export const doseId = (dose: { key: string; minute: number }) => `${dose.key}@${dose.minute}`;

/** Explanations the patient asked for, for this schedule and app language, if they are showing. */
export function useExplanations(proposal: OkProposal): { texts: Record<string, string>; language: Language } | undefined {
  const { state, lang } = useJourney();
  const explanations = state.explanations;
  if (!explanations || explanations.hidden || explanations.requested !== lang || explanations.signature !== scheduleSignature(proposal)) return undefined;
  return { texts: explanations.texts, language: explanations.language };
}

/** One dose's explanation, shown under it in the timeline. */
export function DoseExplanation({ text, language }: { text: string; language: Language }) {
  const { lang } = useJourney();
  const other = language !== lang;
  return (
    <div className="app-explanation">
      <p className="app-explanation__title"><T k="explain.doseTitle" /></p>
      <p className="app-explanation__text" lang={other ? language : undefined} dir={other ? languageInfo(language).dir : undefined}>{text}</p>
    </div>
  );
}

/**
 * Asks AI to explain, in plain words, why each dose is at its time. It may
 * only use the facts the app used to choose the times, and the API checks
 * every explanation against them; any that fail are left out.
 */
export function ExplainPanel({ proposal }: { proposal: OkProposal }) {
  const { state, setState, lang, ai } = useJourney();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const focusLater = useFocusLater();
  const shown = useExplanations(proposal);
  if (ai.mode === 'off' || !proposal.doses.length) return null;
  const signature = scheduleSignature(proposal);
  const cached = state.explanations?.signature === signature && state.explanations.requested === lang ? state.explanations : undefined;

  const explain = async () => {
    if (status === 'loading') return;
    if (cached) {
      setState(current => ({ ...current, explanations: { ...cached, hidden: false } }));
      focusLater('explain-panel');
      return;
    }
    setStatus('loading');
    const facts = scheduleFacts(proposal, lang);
    try {
      const response = await explainSchedule({ language: lang, facts: facts.routine, doses: facts.doses.map(dose => ({ id: dose.id, facts: dose.facts })) });
      const texts: Record<string, string> = {};
      for (const explanation of response.explanations) {
        const dose = facts.doses.find(candidate => candidate.id === explanation.id);
        if (dose) texts[doseId(dose)] = explanation.text;
      }
      if (!Object.keys(texts).length) throw new Error('No explanation passed the checks');
      setState(current => ({ ...current, explanations: { signature, requested: lang, language: response.language, texts, doseCount: facts.doses.length } }));
      setStatus('idle');
      focusLater('explain-panel');
    } catch {
      setStatus('error');
    }
  };

  if (shown && cached) {
    const partial = Object.keys(cached.texts).length < cached.doseCount;
    return (
      <div className="app-ai-panel app-ai-panel--shown" id="explain-panel" tabIndex={-1} data-testid="explain-panel">
        <p className="app-tags"><Tag colour="white"><T k="ai.tag" /></Tag></p>
        <p className="nhsuk-body" role="status"><T k="explain.ready" /></p>
        <p className="nhsuk-body-s"><T k="explain.disclaimer" /></p>
        {partial && <p className="nhsuk-body-s"><T k="explain.partial" /></p>}
        {cached.language !== lang && <p className="app-untranslated"><T k="common.englishOnly" /></p>}
        <p className="nhsuk-u-margin-bottom-0">
          <LinkButton onClick={() => setState(current => (current.explanations ? { ...current, explanations: { ...current.explanations, hidden: true } } : current))}>
            <T k="explain.hide" />
          </LinkButton>
        </p>
      </div>
    );
  }

  return (
    <div className="app-ai-panel" id="explain-panel" tabIndex={-1} data-testid="explain-panel">
      <button type="button" className="nhsuk-button nhsuk-button--secondary app-ai-panel__button" aria-describedby="explain-hint"
        aria-disabled={status === 'loading' || undefined} onClick={explain}>
        {status === 'loading' && <span className="app-spinner" aria-hidden="true" />}
        <T k={status === 'loading' ? 'explain.loading' : 'explain.button'} />
      </button>
      <p className="nhsuk-hint" id="explain-hint"><T k="explain.hint" /></p>
      <p className="app-ai-panel__error" role="status">{status === 'error' && <T k="explain.error" />}</p>
    </div>
  );
}
