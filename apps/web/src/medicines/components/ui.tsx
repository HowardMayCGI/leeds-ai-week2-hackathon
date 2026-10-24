'use client';

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { useJourney } from '../context';
import type { MessageKey, Params } from '../i18n';
import type { Screen } from '../state';

/** Translated text, marked with its language when it falls back to English. */
export function T({ k, params }: { k: MessageKey; params?: Params }) {
  const { tr, lang } = useJourney();
  const { text, lang: actual } = tr(k, params);
  return actual === lang ? <>{text}</> : <span lang={actual} dir="ltr">{text}</span>;
}

/** Latin-script content such as medicine names and strengths, isolated inside right-to-left text. */
export function Latin({ children }: { children: ReactNode }) {
  return <bdi lang="en" dir="ltr">{children}</bdi>;
}

/** Patient-entered free text, kept as entered in whatever direction it was written. */
export function Entered({ children }: { children: ReactNode }) {
  return <bdi dir="auto">{children}</bdi>;
}

export function Time({ value }: { value: string }) {
  const { time } = useJourney();
  return <bdi className="app-time" dir="ltr"><time dateTime={value}>{time(value)}</time></bdi>;
}

/** Text supplied by the record in its own language, flagged when it differs from the interface. */
export function RecordText({ text, language = 'en' }: { text: string; language?: string }) {
  return <bdi lang={language} dir="ltr">{text}</bdi>;
}

export function UntranslatedNote({ language = 'en' }: { language?: string }) {
  const { lang } = useJourney();
  if (lang === language) return null;
  return <p className="app-untranslated"><T k="common.inEnglish" /></p>;
}

export function PageHeading({ children, caption, className = 'nhsuk-heading-l' }: { children: ReactNode; caption?: ReactNode; className?: string }) {
  return (
    <h1 className={className} id="page-heading" tabIndex={-1}>
      {caption && <span className="nhsuk-caption-l">{caption}<span className="nhsuk-u-visually-hidden"> – </span></span>}
      {children}
    </h1>
  );
}

export function Caption() {
  return <T k="common.serviceName" />;
}

export function NavLink({ to, children, className, onClick }: { to?: Screen; children: ReactNode; className?: string; onClick?: () => void }) {
  const { go } = useJourney();
  const navigate = (event: MouseEvent) => {
    event.preventDefault();
    if (onClick) onClick();
    else if (to) go(to);
  };
  return <a href={`#${to ?? ''}`} className={className} onClick={navigate}>{children}</a>;
}

export function BackLink({ to, onClick }: { to?: Screen; onClick?: () => void }) {
  return <NavLink to={to} onClick={onClick} className="nhsuk-back-link"><T k="common.back" /></NavLink>;
}

export interface ErrorItem {
  href: string;
  text: string;
}

/** NHS error summary. Takes focus whenever a new set of errors is shown. */
export function ErrorSummary({ errors, attempt }: { errors: ErrorItem[]; attempt: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length) ref.current?.focus();
    // Focus only when the patient submits, not when errors are re-rendered in another language.
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!errors.length) return null;
  return (
    <div className="nhsuk-error-summary" ref={ref} tabIndex={-1} aria-labelledby="error-summary-title">
      <div role="alert">
        <h2 className="nhsuk-error-summary__heading" id="error-summary-title"><T k="common.errorSummaryTitle" /></h2>
        <div className="nhsuk-error-summary__body">
          <ul className="nhsuk-list nhsuk-error-summary__list">
            {errors.map(error => (
              <li key={error.href}>
                <a href={error.href} onClick={event => {
                  event.preventDefault();
                  const target = document.querySelector<HTMLElement>(error.href);
                  target?.focus();
                  target?.scrollIntoView({ block: 'center' });
                }}>{error.text}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ErrorMessage({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span className="nhsuk-error-message" id={id}>
      <span className="nhsuk-u-visually-hidden"><T k="common.errorPrefix" /> </span>{children}
    </span>
  );
}

export function Tag({ colour, children }: { colour?: 'blue' | 'green' | 'grey' | 'yellow' | 'orange' | 'red' | 'white' | 'purple'; children: ReactNode }) {
  return <strong className={`nhsuk-tag${colour ? ` nhsuk-tag--${colour}` : ''}`}>{children}</strong>;
}

export function Button({ children, onClick, secondary, className = '' }: { children: ReactNode; onClick: () => void; secondary?: boolean; className?: string }) {
  return (
    <button type="button" className={`nhsuk-button${secondary ? ' nhsuk-button--secondary' : ''} ${className}`.trim()} onClick={onClick}>
      {children}
    </button>
  );
}

/** A button styled as a link, for actions that change something on the page. */
export function LinkButton({ children, onClick, className = '' }: { children: ReactNode; onClick: () => void; className?: string }) {
  return <button type="button" className={`app-link-button ${className}`.trim()} onClick={onClick}>{children}</button>;
}

export function InsetText({ children }: { children: ReactNode }) {
  return <div className="nhsuk-inset-text">{children}</div>;
}
