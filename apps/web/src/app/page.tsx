'use client';

import { useRef, useState } from 'react';
import { isRandomNumberResponse } from '@hackathon/api-contract';

export default function Home() {
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
    <div className="nhsuk-grid-row">
      <div className="nhsuk-grid-column-two-thirds">
        <h1 className="nhsuk-heading-xl">Random number generator</h1>
        <p className="nhsuk-body-l">Get a random number from 1 to 100.</p>
        <p className="nhsuk-body">Select the button to generate a number. Each request is independent, so the same number may appear again.</p>
        <button className="nhsuk-button" type="button" aria-disabled={loading} onClick={generate}>
          Generate number
        </button>
        <div role="status" aria-live="polite" aria-atomic="true" className="result">
          {loading ? <p className="nhsuk-body">Generating your number…</p> : !error && number !== null ? (
            <p className="nhsuk-body-l">Your number is <strong className="result__number">{number}</strong></p>
          ) : null}
        </div>
        {error && (
          <div role="alert" aria-labelledby="request-error">
            <h2 className="nhsuk-heading-m" id="request-error">We could not generate a number</h2>
            <p className="nhsuk-body">Please try again using the Generate number button.</p>
          </div>
        )}
      </div>
    </div>
  );
}
