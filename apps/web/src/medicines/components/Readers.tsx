'use client';

import { useRef, useState } from 'react';
import { AI_LIMITS, type RoutineReading } from '@hackathon/api-contract';
import { answersFromReading, type FormAnswers } from '@hackathon/medicines';
import { preparePhoto, readMedicine, readRoutine } from '../ai-client';
import { useJourney } from '../context';
import { ErrorMessage, T, Time, TNodes, useFocusLater } from './ui';

/**
 * AI help to fill in a form: a medicine from a photo or description, or the
 * patient's usual day from their own words. It only fills in answers. The
 * patient checks them, and the form's own checks and rules still apply.
 */

type Status = 'idle' | 'reading' | 'done' | 'not-found' | 'error';

export function MedicineReader({ onFilled }: { onFilled: (answers: FormAnswers) => void }) {
  const { ai, options } = useJourney();
  const [photo, setPhoto] = useState<{ data: string; preview: string }>();
  const [description, setDescription] = useState('');
  const [error, setError] = useState<'empty' | 'photo' | 'tooLong'>();
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<FormAnswers>();
  const fileInput = useRef<HTMLInputElement>(null);
  const focusLater = useFocusLater();
  if (ai.mode === 'off') return null;

  const choosePhoto = async (file: File | undefined) => {
    setError(undefined);
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) throw new Error('Not an image');
      setPhoto(await preparePhoto(file));
    } catch {
      setPhoto(undefined);
      setError('photo');
      focusLater('reader-photo');
    }
  };

  const removePhoto = () => {
    setPhoto(undefined);
    if (fileInput.current) fileInput.current.value = '';
    focusLater('reader-photo');
  };

  const read = async () => {
    if (status === 'reading') return;
    const text = description.replace(/\s+/g, ' ').trim();
    const problem = !photo && !text ? 'empty' : text.length > AI_LIMITS.descriptionChars ? 'tooLong' : undefined;
    setError(problem);
    if (problem) {
      focusLater(problem === 'empty' ? 'reader-photo' : 'reader-description');
      return;
    }
    setStatus('reading');
    try {
      const response = await readMedicine({
        ...(text ? { description: text } : {}),
        ...(photo ? { image: { mediaType: 'image/jpeg' as const, data: photo.data } } : {}),
      });
      if (!response.reading.found) {
        setResult(undefined);
        setStatus('not-found');
      } else {
        const answers = answersFromReading(response.reading, options);
        setResult(answers);
        setStatus('done');
        onFilled(answers);
      }
    } catch {
      setStatus('error');
    }
    focusLater('reader-result');
  };

  return (
    <section className="nhsuk-card app-ai-card" aria-labelledby="reader-title" data-testid="medicine-reader">
      <div className="nhsuk-card__content">
        <h2 className="nhsuk-card__heading nhsuk-heading-s" id="reader-title"><T k="reader.title" /></h2>
        <p className="nhsuk-body-s"><T k="reader.body" /></p>

        <div className={`nhsuk-form-group app-photo${error === 'photo' || error === 'empty' ? ' nhsuk-form-group--error' : ''}`}>
          {(error === 'photo' || error === 'empty') && <ErrorMessage id="reader-photo-error"><T k={`reader.errors.${error}`} /></ErrorMessage>}
          {photo ? (
            <div className="app-photo__chosen">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview, never uploaded anywhere else */}
              <img className="app-photo__preview" src={photo.preview} alt="" />
              <div>
                <p className="nhsuk-body-s app-photo__added"><T k="reader.photoAdded" /></p>
                <button type="button" className="app-link-button" onClick={removePhoto}><T k="reader.removePhoto" /></button>
              </div>
            </div>
          ) : (
            <>
              <input className="app-photo__input" id="reader-photo" type="file" accept="image/*" capture="environment" ref={fileInput}
                aria-describedby={`reader-photo-hint${error === 'photo' || error === 'empty' ? ' reader-photo-error' : ''}`}
                onChange={event => choosePhoto(event.target.files?.[0])} />
              <label className="nhsuk-button nhsuk-button--secondary app-photo__button" htmlFor="reader-photo">
                <svg className="app-photo__icon" aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 4.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                </svg>
                <T k="reader.photoLabel" />
              </label>
            </>
          )}
          <div className="nhsuk-hint nhsuk-u-margin-bottom-0" id="reader-photo-hint"><T k="reader.photoHint" /></div>
        </div>

        <div className={`nhsuk-form-group${error === 'tooLong' ? ' nhsuk-form-group--error' : ''}`}>
          <label className="nhsuk-label" htmlFor="reader-description"><T k="reader.descriptionLabel" /></label>
          <div className="nhsuk-hint" id="reader-description-hint"><T k="reader.descriptionHint" /></div>
          {error === 'tooLong' && <ErrorMessage id="reader-description-error"><T k="reader.errors.tooLong" /></ErrorMessage>}
          <textarea className={`nhsuk-textarea${error === 'tooLong' ? ' nhsuk-textarea--error' : ''}`} id="reader-description" rows={2} dir="auto"
            aria-describedby={`reader-description-hint${error === 'tooLong' ? ' reader-description-error' : ''}`}
            value={description} onChange={event => { setDescription(event.target.value); if (error === 'empty' || error === 'tooLong') setError(undefined); }} />
        </div>

        <button type="button" className="nhsuk-button nhsuk-button--secondary nhsuk-u-margin-bottom-0" aria-disabled={status === 'reading' || undefined} onClick={read}>
          {status === 'reading' && <span className="app-spinner" aria-hidden="true" />}
          <T k={status === 'reading' ? 'reader.loading' : 'reader.submit'} />
        </button>

        <div className="app-ai-result" id="reader-result" tabIndex={-1} role="status">
          {status === 'done' && result && (
            <div className="nhsuk-inset-text app-ai-result__inset">
              <p className="nhsuk-body"><strong><T k="reader.filled" /></strong></p>
              {result.query && <p className="nhsuk-body"><T k="reader.chooseStrength" /></p>}
              {result.manual && <p className="nhsuk-body"><T k="reader.notInList" /></p>}
              {result.missing.length > 0 && (
                <>
                  <p className="nhsuk-body nhsuk-u-margin-bottom-1"><T k="reader.missingTitle" /></p>
                  <ul className="nhsuk-list nhsuk-list--bullet nhsuk-u-margin-bottom-0">
                    {result.missing.map(field => <li key={field}><T k={`reader.missing.${field}`} /></li>)}
                  </ul>
                </>
              )}
            </div>
          )}
          {status === 'not-found' && <p className="nhsuk-body app-ai-result__message"><T k="reader.notFound" /></p>}
          {status === 'error' && <p className="nhsuk-body app-ai-result__message"><T k="reader.error" /></p>}
        </div>
      </div>
    </section>
  );
}

const ROUTINE_PARTS = ['wake', 'breakfast', 'lunch', 'dinner', 'sleep'] as const;

/** Fills in the patient's times from a description of their usual day, for them to check. */
export function DayReader({ onFilled }: { onFilled: (routine: RoutineReading) => void }) {
  const { ai } = useJourney();
  const [text, setText] = useState('');
  const [error, setError] = useState<'empty' | 'tooLong'>();
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<RoutineReading>();
  const focusLater = useFocusLater();
  if (ai.mode === 'off') return null;

  const read = async () => {
    if (status === 'reading') return;
    const value = text.replace(/\s+/g, ' ').trim();
    const problem = !value ? 'empty' : value.length > AI_LIMITS.routineChars ? 'tooLong' : undefined;
    setError(problem);
    if (problem) {
      focusLater('day-description');
      return;
    }
    setStatus('reading');
    try {
      const response = await readRoutine(value);
      const found = ROUTINE_PARTS.some(part => response.routine[part] !== undefined);
      setResult(response.routine);
      setStatus(found ? 'done' : 'not-found');
      if (found) onFilled(response.routine);
    } catch {
      setStatus('error');
    }
    focusLater('day-result');
  };

  const missing = result ? ROUTINE_PARTS.filter(part => result[part] === undefined) : [];

  return (
    <section className="nhsuk-card app-ai-card" aria-labelledby="day-title" data-testid="day-reader">
      <div className="nhsuk-card__content">
        <h2 className="nhsuk-card__heading nhsuk-heading-s" id="day-title"><T k="dayReader.title" /></h2>
        <p className="nhsuk-body-s"><T k="dayReader.body" /></p>
        <div className={`nhsuk-form-group${error ? ' nhsuk-form-group--error' : ''}`}>
          <label className="nhsuk-label" htmlFor="day-description"><T k="dayReader.label" /></label>
          <div className="nhsuk-hint" id="day-description-hint"><T k="dayReader.hint" /></div>
          {error && <ErrorMessage id="day-description-error"><T k={`dayReader.errors.${error}`} /></ErrorMessage>}
          <textarea className={`nhsuk-textarea${error ? ' nhsuk-textarea--error' : ''}`} id="day-description" rows={3} dir="auto"
            aria-describedby={`day-description-hint${error ? ' day-description-error' : ''}`}
            value={text} onChange={event => { setText(event.target.value); if (error) setError(undefined); }} />
        </div>
        <button type="button" className="nhsuk-button nhsuk-button--secondary nhsuk-u-margin-bottom-0" aria-disabled={status === 'reading' || undefined} onClick={read}>
          {status === 'reading' && <span className="app-spinner" aria-hidden="true" />}
          <T k={status === 'reading' ? 'dayReader.loading' : 'dayReader.submit'} />
        </button>
        <div className="app-ai-result" id="day-result" tabIndex={-1} role="status">
          {status === 'done' && result && (
            <div className="nhsuk-inset-text app-ai-result__inset">
              <p className="nhsuk-body"><strong><T k="dayReader.filled" /></strong></p>
              <ul className="nhsuk-list nhsuk-list--bullet">
                {ROUTINE_PARTS.filter(part => result[part] !== undefined).map(part => {
                  const value = result[part];
                  return (
                    <li key={part}>
                      {value === null && part !== 'wake' && part !== 'sleep'
                        ? <T k={`dayReader.skipped.${part}`} />
                        : <TNodes k={`dayReader.found.${part}`} nodes={{ time: <Time value={value!} /> }} />}
                    </li>
                  );
                })}
              </ul>
              {missing.length > 0 && (
                <>
                  <p className="nhsuk-body nhsuk-u-margin-bottom-1"><T k="dayReader.missingTitle" /></p>
                  <ul className="nhsuk-list nhsuk-list--bullet nhsuk-u-margin-bottom-0">
                    {missing.map(part => <li key={part}><T k={`dayReader.missing.${part}`} /></li>)}
                  </ul>
                </>
              )}
            </div>
          )}
          {status === 'not-found' && <p className="nhsuk-body app-ai-result__message"><T k="dayReader.nothing" /></p>}
          {status === 'error' && <p className="nhsuk-body app-ai-result__message"><T k="dayReader.error" /></p>}
        </div>
      </div>
    </section>
  );
}
