'use client';

import { useEffect, useState } from 'react';
import { Showcase } from '../app/showcase';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES, type Language } from './i18n';
import { MedicinesApp } from './MedicinesApp';
import { clearDevice, loadLanguage, storeLanguage } from './state';

/** The web page for Schedule my medicines. Its controls change the app; they are not part of it. */
export function MedicinesPage() {
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const [visit, setVisit] = useState(0);
  const [restarted, setRestarted] = useState(false);

  useEffect(() => {
    const preferred = loadLanguage();
    if (preferred) setLang(preferred);
  }, []);

  const changeLanguage = (next: Language) => {
    setLang(next);
    storeLanguage(next);
  };

  const startAgain = () => {
    clearDevice();
    setVisit(count => count + 1);
    setRestarted(true);
  };

  return (
    <Showcase
      title="Schedule my medicines"
      description={<>Fitted around your day.</>}
      detail="Tell the app when you usually wake up, eat and go to sleep. It suggests a daily schedule for your medicines that follows the instructions for each one, and can remind you when it is time to take them."
      controls={(
        <>
          <div className="showcase-control">
            <label className="showcase-control__label" htmlFor="app-language">App language</label>
            <select id="app-language" className="showcase-select" value={lang} onChange={event => isLanguage(event.target.value) && changeLanguage(event.target.value)}>
              {LANGUAGES.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.label}</option>)}
            </select>
          </div>
          <div className="showcase-control">
            <button type="button" className="showcase-button" onClick={startAgain}>Start again as a new user</button>
            <p className="showcase-control__status" role="status">{restarted ? 'The app has been reset. Saved schedules have been removed from this browser.' : ''}</p>
          </div>
        </>
      )}
    >
      <MedicinesApp key={visit} lang={lang} />
    </Showcase>
  );
}
