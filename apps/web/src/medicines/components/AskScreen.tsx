'use client';

import { useState } from 'react';
import { AI_LIMITS } from '@hackathon/api-contract';
import { askSchedule } from '../ai-client';
import { useJourney } from '../context';
import { itemLabel, scheduleFacts, type FactSource } from '../facts';
import { languageInfo } from '../i18n';
import type { AskEntry } from '../state';
import { BackLink, Caption, Entered, ErrorMessage, ErrorSummary, InsetText, Latin, PageHeading, T, Tag, Time, TName, TNodes, useFocusLater } from './ui';
import { useInteractions } from './Interactions';

type QuestionError = 'empty' | 'tooLong';

/** The sources an answer used, named in the patient's language and listed once each. */
function Sources({ entry }: { entry: AskEntry }) {
  const { state } = useJourney();
  if (entry.answer.kind !== 'answer') return null;
  const items = state.saved?.proposal.items ?? [];
  const label = (key: string) => {
    const item = items.find(candidate => candidate.key === key);
    return item ? itemLabel(item) : '';
  };
  const seen = new Set<string>();
  const sources = entry.answer.factIds
    .map(id => entry.sources[id])
    .filter((source): source is FactSource => Boolean(source))
    .filter(source => {
      const key = JSON.stringify(source);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!sources.length) return null;
  const name = (source: FactSource) => {
    switch (source.kind) {
      case 'routine': return <T k="ask.sources.routine" />;
      case 'dose': return <TNodes k="ask.sources.dose" nodes={{ name: <Latin>{label(source.key)}</Latin>, time: <Time value={source.time} /> }} />;
      case 'medicine': return <Latin>{label(source.key)}</Latin>;
      case 'interaction': return <T k="ask.sources.interaction" />;
      case 'reminders': return <T k="ask.sources.reminders" />;
      case 'review': return <T k="ask.sources.review" />;
    }
  };
  return (
    <div className="app-conversation__sources">
      <p className="app-conversation__sources-title"><T k="ask.basedOn" /></p>
      <ul className="nhsuk-list nhsuk-list--bullet">
        {sources.map((source, index) => <li key={index}>{name(source)}</li>)}
      </ul>
    </div>
  );
}

function Answer({ entry }: { entry: AskEntry }) {
  const { lang } = useJourney();
  const { answer } = entry;
  if (answer.kind === 'emergency') {
    return (
      <div className="nhsuk-card nhsuk-card--care nhsuk-card--care--emergency app-conversation__emergency">
        <div className="nhsuk-card__heading-container">
          <h3 className="nhsuk-card__heading">
            <span role="text"><span className="nhsuk-u-visually-hidden"><T k="ask.emergencyHidden" />: </span><T k="ask.emergencyTitle" /></span>
          </h3>
          <span className="nhsuk-card--care__arrow" aria-hidden="true" />
        </div>
        <div className="nhsuk-card__content">
          <p className="nhsuk-body"><T k="ask.emergencyBody" /></p>
        </div>
      </div>
    );
  }
  if (answer.kind === 'cannot-answer') return <p className="nhsuk-body app-conversation__text"><T k={`ask.cannot.${answer.reason}`} /></p>;
  const other = entry.language !== lang;
  return (
    <>
      <p className="app-tags"><Tag colour="white"><T k="ai.tag" /></Tag></p>
      <p className="nhsuk-body app-conversation__text" lang={other ? entry.language : undefined} dir={other ? languageInfo(entry.language).dir : undefined}>{answer.text}</p>
      {other && <p className="app-untranslated"><T k="common.englishOnly" /></p>}
      <Sources entry={entry} />
    </>
  );
}

/**
 * Questions about the saved schedule. Answers may only use what the app knows
 * about the schedule, and the API checks each one. Emergencies and requests
 * for medical advice always get the app's own wording.
 */
export function AskScreen() {
  const { state, setState, lang, t, tr } = useJourney();
  const saved = state.saved;
  const interactions = useInteractions(saved?.proposal.items ?? []);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<QuestionError>();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const focusLater = useFocusLater();
  if (!saved) return null;

  const proposal = saved.proposal;
  const named = proposal.items.filter(item => proposal.doses.some(dose => dose.key === item.key));
  const suggestions = [
    named[0] && { key: 'ask.suggestions.when' as const, name: named[0].name },
    (named[1] ?? named[0]) && { key: 'ask.suggestions.why' as const, name: (named[1] ?? named[0]).name },
  ].filter((suggestion): suggestion is { key: 'ask.suggestions.when' | 'ask.suggestions.why'; name: string } => Boolean(suggestion));

  const ask = async (text: string) => {
    if (status === 'loading') return;
    const value = text.replace(/\s+/g, ' ').trim();
    const problem: QuestionError | undefined = !value ? 'empty' : value.length > AI_LIMITS.questionChars ? 'tooLong' : undefined;
    setError(problem);
    setAttempt(count => count + 1);
    if (problem) return;
    setStatus('loading');
    const facts = scheduleFacts(proposal, lang, {
      interactions: interactions.check.status === 'ready' ? interactions.check.value.interactions : [],
      reminders: saved.reminders,
      savedAt: saved.savedAt,
      reviewRequestedAt: saved.reviewRequestedAt,
    });
    try {
      const response = await askSchedule({ language: lang, question: value, facts: facts.all });
      const entry: AskEntry = { id: `q${Date.now().toString(36)}`, question: value, answer: response.answer, language: response.language, sources: facts.sources };
      setState(current => ({ ...current, asked: [...current.asked, entry] }));
      setQuestion('');
      setStatus('idle');
      focusLater(`answer-${entry.id}`);
    } catch {
      setStatus('error');
    }
  };

  const errorText = error ? t(`ask.errors.${error}`) : '';

  return (
    <>
      <BackLink to="schedule" />
      <ErrorSummary attempt={attempt} errors={error ? [{ href: '#ask-question', text: errorText }] : []} />
      <PageHeading caption={<Caption />}><T k="ask.title" /></PageHeading>
      <p className="nhsuk-body"><T k="ask.lede" /></p>
      <InsetText><p><T k="ask.limits" /></p></InsetText>

      {state.asked.length > 0 && (
        <ol className="app-conversation" aria-label={t('ask.title')}>
          {state.asked.map(entry => (
            <li className="app-conversation__entry" key={entry.id}>
              <div className="app-conversation__question">
                <p className="app-conversation__label"><T k="ask.question" /></p>
                <p className="nhsuk-body app-conversation__text"><Entered>{entry.question}</Entered></p>
              </div>
              <div className="app-conversation__answer" id={`answer-${entry.id}`} tabIndex={-1}>
                <p className="app-conversation__label"><T k="ask.answer" /></p>
                <Answer entry={entry} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {suggestions.length > 0 && (
        <div className="app-suggestions">
          <h2 className="nhsuk-heading-s" id="suggestions-title"><T k="ask.suggestionsTitle" /></h2>
          <ul className="app-suggestions__list" aria-labelledby="suggestions-title">
            {suggestions.map(suggestion => {
              const text = tr(suggestion.key, { name: suggestion.name }).text;
              return (
                <li key={suggestion.key}>
                  <button type="button" className="app-suggestion" onClick={() => { setQuestion(text); ask(text); }}>
                    <TName k={suggestion.key} name={suggestion.name} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className={`nhsuk-form-group${error ? ' nhsuk-form-group--error' : ''}`}>
        <label className="nhsuk-label nhsuk-label--s" htmlFor="ask-question"><T k="ask.label" /></label>
        <div className="nhsuk-hint" id="ask-question-hint"><T k="ask.hint" /></div>
        {error && <ErrorMessage id="ask-question-error">{errorText}</ErrorMessage>}
        <textarea className={`nhsuk-textarea${error ? ' nhsuk-textarea--error' : ''}`} id="ask-question" name="ask-question" rows={3} dir="auto"
          aria-describedby={`ask-question-hint${error ? ' ask-question-error' : ''}`} value={question}
          onChange={event => { setQuestion(event.target.value); if (error) setError(undefined); }} />
      </div>
      <button type="button" className="nhsuk-button" aria-disabled={status === 'loading' || undefined} onClick={() => ask(question)}>
        {status === 'loading' && <span className="app-spinner app-spinner--light" aria-hidden="true" />}
        <T k={status === 'loading' ? 'ask.loading' : 'ask.submit'} />
      </button>
      <p className="app-ai-panel__error" role="status">{status === 'error' && <T k="ask.error" />}</p>
      <p className="nhsuk-body-s app-small-print"><T k="ask.footer" /></p>
    </>
  );
}
