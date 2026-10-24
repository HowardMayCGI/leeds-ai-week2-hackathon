'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { routinePages } from '@hackathon/medicines';
import { AppChrome } from '../app/app-chrome';
import { CheckAnswers } from './components/CheckAnswers';
import { AdditionForm, Additions, SelectMedicines } from './components/MedicineScreens';
import { RoutineScreen } from './components/RoutineScreen';
import { ProposalScreen, RemindersScreen, ReviewConfirmation, SavedConfirmation, SavedScheduleScreen } from './components/ScheduleScreens';
import { Intro, Prescriptions } from './components/StartScreens';
import { JourneyContext, type Journey } from './context';
import { DEFAULT_LANGUAGE, formatDate, formatTime, isLanguage, LANGUAGES, languageInfo, translate, type Language } from './i18n';
import { initialState, loadLanguage, loadSaved, storeLanguage, storeSaved, type Screen, type State } from './state';

const [wakingSleeping, mealTimes] = routinePages();

/** Screens that only make sense with something to show; anything else falls back to the start. */
function canShow(screen: Screen, state: State): boolean {
  if (screen === 'proposal') return Boolean(state.proposal);
  if (['saved-confirmation', 'schedule', 'reminders', 'review-confirmation'].includes(screen)) return Boolean(state.saved);
  return true;
}

function LanguageSelect({ lang, onChange, label }: { lang: Language; onChange: (lang: Language) => void; label: string }) {
  return (
    <div className="app-language">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
      </svg>
      <label className="nhsuk-u-visually-hidden" htmlFor="language-select">{label === 'Language' ? label : `${label} (Language)`}</label>
      <select id="language-select" className="app-language__select" value={lang} onChange={event => isLanguage(event.target.value) && onChange(event.target.value)}>
        {LANGUAGES.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.label}</option>)}
      </select>
    </div>
  );
}

export function MedicinesApp() {
  const [state, setStateRaw] = useState<State>(initialState);
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const loaded = useRef(false);
  const firstScreen = useRef(true);
  const popping = useRef(false);

  // Restore the device's language preference and the demo's saved schedule after hydration.
  useEffect(() => {
    const preferred = loadLanguage();
    if (preferred) setLang(preferred);
    const saved = loadSaved();
    if (saved) setStateRaw(current => ({ ...current, saved }));
    loaded.current = true;
    window.history.replaceState({ screen: 'prescriptions' }, '');
  }, []);

  useEffect(() => {
    if (loaded.current) storeSaved(state.saved);
  }, [state.saved]);

  useEffect(() => {
    const { dir } = languageInfo(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  // Move focus to the new page heading, as a full page load would, but not on first load or language change.
  useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return; }
    if (popping.current) popping.current = false;
    else window.history.pushState({ screen: state.screen }, '');
    document.querySelector('.phone-screen')?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
    document.getElementById('page-heading')?.focus({ preventScroll: true });
  }, [state.screen, state.editingAdditionId]);

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

  const changeLanguage = (next: Language) => {
    setLang(next);
    storeLanguage(next);
  };

  const journey = useMemo<Journey>(() => {
    const go: Journey['go'] = (screen, changes = {}) => setState(current => {
      const flow = changes.changeFlow === undefined && 'changeFlow' in changes ? undefined : changes.changeFlow ?? current.changeFlow;
      return { ...current, ...changes, screen, changeFlow: flow && screen === flow.origin ? undefined : flow };
    });
    return {
      state,
      lang,
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
  }, [state, lang, setState]);

  const screens: Record<Screen, () => ReactNode> = {
    prescriptions: () => <Prescriptions />,
    intro: () => <Intro />,
    'waking-sleeping': () => <RoutineScreen key="waking-sleeping" group={wakingSleeping} previous="intro" nextScreen="meal-times" />,
    'meal-times': () => <RoutineScreen key="meal-times" group={mealTimes} previous="waking-sleeping" nextScreen="medicines" />,
    medicines: () => <SelectMedicines />,
    additions: () => <Additions />,
    'addition-form': () => <AdditionForm key={state.editingAdditionId ?? 'new'} />,
    check: () => <CheckAnswers />,
    proposal: () => <ProposalScreen />,
    'saved-confirmation': () => <SavedConfirmation />,
    schedule: () => <SavedScheduleScreen />,
    reminders: () => <RemindersScreen />,
    'review-confirmation': () => <ReviewConfirmation />,
  };
  const screen = canShow(state.screen, state) ? state.screen : 'prescriptions';

  return (
    <JourneyContext.Provider value={journey}>
      <AppChrome
        headerExtra={<LanguageSelect lang={lang} onChange={changeLanguage} label={translate(lang, 'common.language').text} />}
        footer={translate(lang, 'common.demoFooter').text}
      >
        <div className="app-screen" data-screen={screen}>{screens[screen]()}</div>
      </AppChrome>
    </JourneyContext.Provider>
  );
}
