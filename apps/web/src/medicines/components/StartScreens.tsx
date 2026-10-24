'use client';

import { useState } from 'react';
import { DEMO_RECORD } from '@hackathon/medicines';
import { useJourney } from '../context';
import { emptyDraft, storeSaved } from '../state';
import { BackLink, Button, Caption, LinkButton, PageHeading, T } from './ui';

function Chevron() {
  return (
    <svg className="app-menu__chevron" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Prescriptions() {
  const { state, go, setState } = useJourney();
  const [reset, setReset] = useState(false);
  const open = () => {
    if (state.saved) go('schedule', { updating: false, proposal: undefined, changeFlow: undefined });
    else go('intro');
  };
  const resetDemo = () => {
    storeSaved(undefined);
    setState(() => ({ screen: 'prescriptions', draft: emptyDraft(), updating: false }));
    setReset(true);
  };
  return (
    <>
      <PageHeading><T k="prescriptions.title" /></PageHeading>
      <p className="nhsuk-body-l"><T k="prescriptions.lede" /></p>
      <ul className="app-menu">
        <li className="app-menu__item app-menu__item--inactive">
          <span className="app-menu__text"><strong><T k="prescriptions.orderRepeat" /></strong><span><T k="prescriptions.orderRepeatDetail" /></span></span>
        </li>
        <li className="app-menu__item app-menu__item--inactive">
          <span className="app-menu__text"><strong><T k="prescriptions.yourMedicines" /></strong><span><T k="prescriptions.yourMedicinesDetail" params={{ count: DEMO_RECORD.length }} /></span></span>
        </li>
        <li className="app-menu__item">
          <a href="#schedule-my-medicines" className="app-menu__link" onClick={event => { event.preventDefault(); open(); }}>
            <span className="app-menu__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15.5" r="2" /></svg>
            </span>
            <span className="app-menu__text">
              <strong><T k="prescriptions.schedule" /></strong>
              <span>{state.saved ? <T k="prescriptions.scheduleSaved" /> : <T k="prescriptions.scheduleNew" />}</span>
            </span>
            <Chevron />
          </a>
        </li>
      </ul>
      <p className="app-small-print"><T k="prescriptions.demoOnly" /></p>
      {reset && <p className="app-small-print" role="status"><T k="prescriptions.resetDone" /></p>}
      {state.saved && (
        <div className="app-demo-controls">
          <p className="app-small-print"><T k="prescriptions.storageNote" /></p>
          <LinkButton onClick={resetDemo}><T k="prescriptions.resetDemo" /></LinkButton>
        </div>
      )}
    </>
  );
}

export function Intro() {
  const { next } = useJourney();
  return (
    <>
      <BackLink to="prescriptions" />
      <PageHeading caption={<Caption />}><T k="intro.title" /></PageHeading>
      <p className="nhsuk-body-l"><T k="intro.lede" /></p>
      <h2 className="nhsuk-heading-m"><T k="intro.needTitle" /></h2>
      <ul className="nhsuk-list nhsuk-list--bullet">
        <li><T k="intro.need1" /></li>
        <li><T k="intro.need2" /></li>
        <li><T k="intro.need3" /></li>
      </ul>
      <p><T k="intro.time" /></p>
      <div className="nhsuk-card nhsuk-card--warning">
        <div className="nhsuk-card__content">
          <h2 className="nhsuk-card__heading"><T k="intro.warningTitle" /></h2>
          <p className="nhsuk-card__description"><T k="intro.warning" /></p>
        </div>
      </div>
      <Button onClick={() => next('intro', 'waking-sleeping')}><T k="intro.start" /></Button>
    </>
  );
}
