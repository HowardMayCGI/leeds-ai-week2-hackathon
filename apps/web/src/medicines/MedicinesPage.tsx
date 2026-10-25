'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AiStatusResponse, PatientSummary } from '@hackathon/api-contract';
import { AppChrome } from '../app/app-chrome';
import { Showcase } from '../app/showcase';
import { AI_OFF, fetchAiStatus } from './ai-client';
import { DEFAULT_LANGUAGE, isLanguage, languageInfo, LANGUAGES, translate, type Language } from './i18n';
import { MedicinesApp } from './MedicinesApp';
import { displayName, fetchPatientData, fetchPatients, type PatientData } from './patient-data';
import { clearDevice, loadLanguage, loadPatient, storeLanguage, storePatient } from './state';

type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

/** The web page for Schedule my medicines. Its controls change the app; they are not part of it. */
export function MedicinesPage() {
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const [patients, setPatients] = useState<Load<PatientSummary[]>>({ status: 'loading' });
  const [patient, setPatient] = useState<string>();
  // The record is kept with the patient it belongs to, so the app never shows one patient's record for another.
  const [data, setData] = useState<Load<{ patient: string; record: PatientData }>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [visit, setVisit] = useState(0);
  const [status, setStatus] = useState('');
  const [ai, setAi] = useState<{ known: boolean; value: AiStatusResponse }>({ known: false, value: AI_OFF });

  useEffect(() => {
    const preferred = loadLanguage();
    if (preferred) setLang(preferred);
    const controller = new AbortController();
    fetchAiStatus(controller.signal).then(value => { if (!controller.signal.aborted) setAi({ known: true, value }); });
    return () => controller.abort();
  }, []);

  // The patient list, then the remembered patient or the first one.
  useEffect(() => {
    const controller = new AbortController();
    setPatients({ status: 'loading' });
    fetchPatients(controller.signal).then(list => {
      setPatients({ status: 'ready', value: list });
      const remembered = loadPatient();
      setPatient(current => current ?? (list.some(item => item.nhsNumber === remembered) ? remembered : list[0]?.nhsNumber));
    }).catch(() => {
      if (!controller.signal.aborted) setPatients({ status: 'error' });
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!patient) return;
    const controller = new AbortController();
    setData({ status: 'loading' });
    fetchPatientData(patient, controller.signal)
      .then(record => setData({ status: 'ready', value: { patient, record } }))
      .catch(() => { if (!controller.signal.aborted) setData({ status: 'error' }); });
    return () => controller.abort();
  }, [patient, attempt]);

  const changeLanguage = (next: Language) => {
    setLang(next);
    storeLanguage(next);
  };

  const changePatient = (next: string) => {
    setPatient(next);
    storePatient(next);
    const name = patients.status === 'ready' ? patients.value.find(item => item.nhsNumber === next)?.name : undefined;
    setStatus(name ? `Showing the app for ${displayName(name)}.` : '');
  };

  const startAgain = () => {
    if (patient) clearDevice(patient);
    setVisit(count => count + 1);
    setStatus('The app has been reset. This patient’s saved schedule has been removed from this browser.');
  };

  const retry = useCallback(() => setAttempt(count => count + 1), []);
  const summary = patients.status === 'ready' ? patients.value.find(item => item.nhsNumber === patient) : undefined;

  return (
    <Showcase
      title="Schedule my medicines"
      description={<>Fitted around your day.</>}
      detail="Tell the app when you usually wake up, eat and go to sleep. It suggests a daily schedule for your medicines that follows the instructions for each one, and can remind you when it is time to take them."
      status={ai.known ? <AiStatus status={ai.value} /> : undefined}
      controls={(
        <>
          <div className="showcase-control">
            <label className="showcase-control__label" htmlFor="app-patient">Patient</label>
            <select id="app-patient" className="showcase-select" value={patient ?? ''} disabled={patients.status !== 'ready'}
              onChange={event => changePatient(event.target.value)}>
              {patients.status === 'ready'
                ? patients.value.map(item => <option key={item.nhsNumber} value={item.nhsNumber}>{displayName(item.name)}</option>)
                : <option value="">{patients.status === 'loading' ? 'Loading patients…' : 'Patients unavailable'}</option>}
            </select>
          </div>
          <div className="showcase-control">
            <label className="showcase-control__label" htmlFor="app-language">App language</label>
            <select id="app-language" className="showcase-select" value={lang} onChange={event => isLanguage(event.target.value) && changeLanguage(event.target.value)}>
              {LANGUAGES.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.label}</option>)}
            </select>
          </div>
          <div className="showcase-control">
            <button type="button" className="showcase-button" onClick={startAgain} disabled={!patient}>Start again as a new user</button>
            <p className="showcase-control__status" role="status">{status}</p>
          </div>
        </>
      )}
    >
      {summary && data.status === 'ready' && data.value.patient === patient
        ? <MedicinesApp key={`${patient}-${visit}`} lang={lang} patient={summary} record={data.value.record.record} options={data.value.record.options} ai={ai.value} />
        : <AppStatus lang={lang} failed={patients.status === 'error' || data.status === 'error'} onRetry={retry} />}
    </Showcase>
  );
}

/** How AI help is running, for people looking at the web page. */
function AiStatus({ status }: { status: AiStatusResponse }) {
  if (status.mode === 'live') {
    return (
      <>
        <strong>AI help is on.</strong> {status.model ?? 'Claude'} reads medicine labels and descriptions, fills in the usual day, explains the schedule and answers questions about it. The app checks every AI answer against the schedule, and the patient confirms anything that changes it.
      </>
    );
  }
  if (status.mode === 'test') {
    return <><strong>AI help is in test mode.</strong> Answers come from built-in examples, not an AI model, so every photo reads as the same example medicine.</>;
  }
  return <><strong>AI help is off.</strong> Everything else in the app works as normal.</>;
}

/** What the app shows while its data loads, or if it cannot be loaded. */
function AppStatus({ lang, failed, onRetry }: { lang: Language; failed: boolean; onRetry: () => void }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const text = (key: Parameters<typeof translate>[1]) => {
    const { text: value, lang: actual } = t(key);
    return actual === lang ? value : <span lang={actual} dir="ltr">{value}</span>;
  };
  return (
    <AppChrome lang={lang} dir={languageInfo(lang).dir}>
      {failed ? (
        <div className="app-screen" data-screen="unavailable">
          <h1 className="nhsuk-heading-l" id="page-heading" tabIndex={-1}>{text('loading.errorTitle')}</h1>
          <p className="nhsuk-body">{text('loading.errorBody')}</p>
          <button type="button" className="nhsuk-button" onClick={onRetry}>{text('loading.retry')}</button>
        </div>
      ) : (
        <div className="app-screen app-loading" data-screen="loading" role="status">
          <span className="app-loading__spinner" aria-hidden="true" />
          <p className="nhsuk-body">{text('loading.body')}</p>
        </div>
      )}
    </AppChrome>
  );
}
