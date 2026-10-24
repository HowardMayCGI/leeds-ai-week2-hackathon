'use client';

import { useRef, useState } from 'react';
import { isRandomNumberResponse } from '@hackathon/api-contract';
import { AppChrome } from '../app-chrome';
import { Showcase } from '../showcase';

export function RandomGenerator() {
  const [number, setNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);

  async function generate() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/api/random', { cache: 'no-store' });
      if (!response.ok) throw new Error('Request failed');
      const result: unknown = await response.json();
      if (!isRandomNumberResponse(result)) throw new Error('Invalid response');
      setNumber(result.number);
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <Showcase title="Random numbers" description={<>A simple number generator.<br />A familiar app experience.</>}>
      <AppChrome>
        <h1 className="app-title">Random number generator</h1>
        <p className="app-description">Generate a random number from 1 to 100.</p>

        <div className="generator-card">
          <div className="generator-card__heading">
            <h2>Your result</h2>
            <span className="generator-card__range">1–100</span>
          </div>
          <div role="status" aria-live="polite" aria-atomic="true" className="result">
            {loading ? (
              <>
                <span className="result__number result__number--empty" aria-hidden="true">···</span>
                <p className="result__caption">Generating your number…</p>
              </>
            ) : !error && number !== null ? (
              <p className="result__value"><span className="nhsuk-u-visually-hidden">Your number is </span><strong className="result__number">{number}</strong><span className="result__caption">Your number is ready</span></p>
            ) : (
              <>
                <span className="result__number result__number--empty" aria-hidden="true">—</span>
                <p className="result__caption">{error ? 'Try generating a number again' : 'Ready when you are'}</p>
              </>
            )}
          </div>
          <button className="nhsuk-button generator-button" type="button" aria-disabled={loading} onClick={generate}>
            Generate number
          </button>
        </div>

        {error && (
          <div className="request-error" role="alert" aria-labelledby="request-error">
            <h2 id="request-error">We could not generate a number</h2>
            <p>Please try again using the Generate number button.</p>
          </div>
        )}

        <div className="generator-note">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" /></svg>
          <p>Each number is chosen independently. The same number may appear again.</p>
        </div>
      </AppChrome>
    </Showcase>
  );
}
