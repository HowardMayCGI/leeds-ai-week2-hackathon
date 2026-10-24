'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PatientSummary } from '@hackathon/api-contract';
import { routinePages, type MedicineOption, type RecordMedicine } from '@hackathon/medicines';
import { AppChrome } from '../app/app-chrome';
import { CheckAnswers } from './components/CheckAnswers';
import { AdditionForm, Additions, AdditionTiming, RecordDetailsScreen, SelectMedicines } from './components/MedicineScreens';
import { RoutineScreen } from './components/RoutineScreen';
import { ProposalScreen, RemindersScreen, ReviewConfirmation, SavedConfirmation, SavedScheduleScreen } from './components/ScheduleScreens';
import { Intro, Prescriptions } from './components/StartScreens';
import { JourneyContext, type Journey } from './context';
import { BottomNav, MessagesScreen, ProfileScreen } from './components/AppNav';
import { formatDate, formatTime, languageInfo, translate, type Language } from './i18n';
import { initialState, loadSaved, storeSaved, type Screen, type State } from './state';

const [wakingSleeping, mealTimes] = routinePages();

/** Screens that only make sense with something to show; anything else falls back to the start. */
function canShow(screen: Screen, state: State): boolean {
  if (screen === 'proposal') return Boolean(state.proposal);
  if (screen === 'record-details') return Boolean(state.editingRecordId);
  if (screen === 'addition-timing') return state.draft.additions.some(addition => addition.id === state.editingAdditionId);
  if (['saved-confirmation', 'schedule', 'reminders', 'review-confirmation'].includes(screen)) return Boolean(state.saved);
  return true;
}

export function MedicinesApp({ lang, patient, record, options }: {
  lang: Language;
  patient: PatientSummary;
  record: RecordMedicine[];
  options: MedicineOption[];
}) {
  // The app renders only in the browser, once the record has loaded, so the saved schedule can be read straight away.
  const [state, setStateRaw] = useState<State>(() => ({ ...initialState(), saved: loadSaved(patient.nhsNumber) }));
  const firstScreen = useRef(true);
  const popping = useRef(false);

  useEffect(() => {
    window.history.replaceState({ screen: 'prescriptions' }, '');
  }, []);

  useEffect(() => {
    storeSaved(patient.nhsNumber, state.saved);
  }, [state.saved, patient.nhsNumber]);

  // Move focus to the new page heading, as a full page load would, but not on first load or language change.
  useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return; }
    if (popping.current) popping.current = false;
    else window.history.pushState({ screen: state.screen }, '');
    document.querySelector('.app-main')?.scrollTo?.({ top: 0 });
    document.querySelector('.phone-screen')?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
    document.getElementById('page-heading')?.focus({ preventScroll: true });
  }, [state.screen, state.editingAdditionId, state.editingRecordId]);

  useEffect(() => {
    const heading = document.getElementById('page-heading')?.textContent?.trim();
    document.title = `${heading ? `${heading} – ` : ''}${translate(lang, 'common.pageTitleSuffix').text}`;
  });

  const setState = useCallback((update: (state: State) => State) => setStateRaw(update), []);

  // Browser Back moves between screens, never to a screen whose data has gone.
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const screen = (event.state?.screen ?? 'prescriptions') as Screen;
      popping.current = true;
      setStateRaw(current => {
        const target = canShow(screen, current) ? screen : current.saved ? 'schedule' : 'prescriptions';
        return { ...current, screen: target, changeFlow: undefined };
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const journey = useMemo<Journey>(() => {
    const go: Journey['go'] = (screen, changes = {}) => setState(current => {
      const flow = changes.changeFlow === undefined && 'changeFlow' in changes ? undefined : changes.changeFlow ?? current.changeFlow;
      return { ...current, ...changes, screen, changeFlow: flow && screen === flow.origin ? undefined : flow };
    });
    return {
      state,
      lang,
      patient,
      record,
      options,
      t: (key, params) => translate(lang, key, params).text,
      tr: (key, params) => translate(lang, key, params),
      time: value => formatTime(value, lang),
      date: iso => formatDate(iso, lang),
      go,
      setState,
      updateDraft: update => setState(current => ({ ...current, draft: update(current.draft) })),
      next: (from, to) => {
        if (state.changeFlow?.end === from) go('check', { changeFlow: undefined });
        else go(to);
      },
      back: (from, previous) => (state.changeFlow?.start === from ? state.changeFlow.origin : previous),
      startChange: flow => go(flow.start, { changeFlow: flow }),
    };
  }, [state, lang, patient, record, options, setState]);

  const screens: Record<Screen, () => ReactNode> = {
    prescriptions: () => <Prescriptions />,
    intro: () => <Intro />,
    'waking-sleeping': () => <RoutineScreen key="waking-sleeping" group={wakingSleeping} previous="intro" nextScreen="meal-times" />,
    'meal-times': () => <RoutineScreen key="meal-times" group={mealTimes} previous="waking-sleeping" nextScreen="medicines" />,
    medicines: () => <SelectMedicines />,
    'record-details': () => <RecordDetailsScreen key={state.editingRecordId} />,
    additions: () => <Additions />,
    'addition-form': () => <AdditionForm key={state.editingAdditionId ?? 'new'} />,
    'addition-timing': () => <AdditionTiming key={state.editingAdditionId} />,
    check: () => <CheckAnswers />,
    proposal: () => <ProposalScreen />,
    'saved-confirmation': () => <SavedConfirmation />,
    schedule: () => <SavedScheduleScreen />,
    reminders: () => <RemindersScreen />,
    'review-confirmation': () => <ReviewConfirmation />,
    messages: () => <MessagesScreen />,
    profile: () => <ProfileScreen />,
  };
  const screen = canShow(state.screen, state) ? state.screen : 'prescriptions';

  return (
    <JourneyContext.Provider value={journey}>
      <AppChrome lang={lang} dir={languageInfo(lang).dir} nav={<BottomNav screen={screen} />}>
        <div className="app-screen" data-screen={screen}>{screens[screen]()}</div>
      </AppChrome>
    </JourneyContext.Provider>
  );
}
