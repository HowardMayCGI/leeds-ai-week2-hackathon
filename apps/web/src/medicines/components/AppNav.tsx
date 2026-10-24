'use client';

import type { ReactNode } from 'react';
import { useJourney } from '../context';
import type { Screen } from '../state';
import { displayName } from '../patient-data';
import { Latin, NavLink, PageHeading, T } from './ui';

// Icons from the NHS App design system (nhsapp-frontend), outlined and filled.
const ICONS = {
  home: {
    outline: 'm21.82 9.73-1.29-1.07v-.03h-.03l-7.55-6.3c-.56-.45-1.35-.45-1.92.01L3.5 8.63h-.03v.03L2.18 9.73c-.32.26-.36.74-.09 1.06.15.18.36.27.58.27.17 0 .34-.06.48-.17l.33-.27v10.57c0 .41.34.75.75.75h15.56c.41 0 .75-.34.75-.75V10.62l.33.27c.32.27.79.22 1.06-.09.27-.32.22-.79-.09-1.06Zm-11.4 10.7v-6.8c0-.09.04-.14.03-.15h3.09s.06.06.06.15v6.8h-3.17Zm8.62 0h-3.95v-6.8c0-.91-.69-1.65-1.53-1.65h-3.11c-.84 0-1.53.74-1.53 1.65v6.8H4.97V9.36l7.04-5.87 7.03 5.87v11.07Z',
    filled: 'm21.82 9.73-1.29-1.07v-.03h-.03l-7.55-6.3c-.56-.45-1.35-.45-1.92.01L3.5 8.63h-.03v.03L2.18 9.73c-.32.26-.36.74-.09 1.06.15.18.36.27.58.27.17 0 .34-.06.48-.17l.33-.27v10.57c0 .41.34.75.75.75h15.56c.41 0 .75-.34.75-.75V10.62l.33.27c.32.27.79.22 1.06-.09.27-.32.22-.79-.09-1.06Zm-7.48 11.45H9.67v-7.55c0-.5.35-.9.78-.9h3.11c.43 0 .78.4.78.9v7.55Z',
  },
  messages: {
    outline: 'M21.75 11.38a.76.76 0 0 0-.7-.08l-.77.31V4.47c0-.41-.34-.75-.75-.75H4.47c-.41 0-.75.34-.75.75v7.15l-.78-.31a.76.76 0 0 0-.7.08c-.21.14-.33.37-.33.62v9.27c0 .41.34.75.75.75h18.67c.41 0 .75-.34.75-.75v-9.27c0-.25-.12-.48-.33-.62ZM5.22 5.22h13.56v6.97L12 14.94l-6.78-2.75V5.22Zm15.36 15.3H3.41v-7.41l8.31 3.34c.18.07.38.07.56 0l8.3-3.34v7.41Z',
    filled: 'M21.44 12.66c-.75.34-1.64.67-1.8.73l-7.46 3.05c-.06.02-.12.03-.18.04-.06 0-.12-.01-.18-.04l-7.46-3.05c-.16-.06-1.05-.4-1.8-.73a.397.397 0 0 0-.56.37v8.16c0 .46.37.83.82.83h18.35c.45 0 .82-.37.82-.83v-8.16c0-.29-.3-.48-.56-.37ZM19.53 3.72H4.47c-.41 0-.75.34-.75.75v7.11L12 14.9l8.28-3.32V4.47c0-.41-.34-.75-.75-.75Z',
  },
  profile: {
    outline: 'M12 6.85c-1.94 0-3.52 1.58-3.52 3.52s1.58 3.52 3.52 3.52 3.52-1.58 3.52-3.52S13.94 6.85 12 6.85ZM12.03 2.01c-5.49 0-9.96 4.49-9.96 10s4.47 10.01 9.96 10.01 9.96-4.49 9.96-10.01-4.47-10-9.96-10Zm5.67 16.3c-.25-2.14-1.82-3.8-3.75-3.8h-3.91c-1.91 0-3.48 1.63-3.74 3.75a8.497 8.497 0 0 1-2.73-6.24c0-4.7 3.8-8.51 8.46-8.51s8.46 3.82 8.46 8.51c0 2.49-1.08 4.73-2.79 6.29Z',
    filled: 'M11.96 2C17.4607 2 21.9199 6.47933 21.9199 12.0049C21.9199 17.5305 17.4607 22.0098 11.96 22.0098C6.45922 22.0097 2 17.5305 2 12.0049C2.00006 6.47934 6.45926 2.00002 11.96 2ZM9.96973 14.5C8.05986 14.5001 6.49048 16.1301 6.23047 18.25C7.00056 19 8.50525 20.1681 9.08008 20.5C9.65489 20.8318 9.93004 20.5 11.9297 20.5C13.9297 20.5 13.7803 21 14.7803 20.5C15.7803 19.9999 17.6299 18.3096 17.6299 18.3096V18.2998C17.3798 16.1599 15.8098 14.5 13.8799 14.5H9.96973ZM12 5.71973C9.70802 5.71973 7.84961 7.57814 7.84961 9.87012C7.84967 12.162 9.70806 14.0195 12 14.0195C14.2919 14.0195 16.1503 12.162 16.1504 9.87012C16.1504 7.57814 14.292 5.71974 12 5.71973Z M20.42 12.005C20.4199 7.30143 16.6259 3.50002 11.96 3.50002C7.29408 3.50004 3.50007 7.30145 3.50001 12.005C3.50001 16.7086 7.29404 20.51 11.96 20.51L11.96 22.0098C6.45922 22.0097 2 17.5305 2 12.0049C2.00006 6.47934 6.45926 2.00002 11.96 2C17.4607 2 21.9199 6.47933 21.9199 12.0049C21.9199 17.5305 17.4607 22.0098 11.96 22.0098L11.96 20.51C16.626 20.51 20.42 16.7086 20.42 12.005Z',
  },
};

type Hub = keyof typeof ICONS;
const HUB_SCREEN: Record<Hub, Screen> = { home: 'prescriptions', messages: 'messages', profile: 'profile' };

function hubOf(screen: Screen): Hub {
  return screen === 'messages' ? 'messages' : screen === 'profile' ? 'profile' : 'home';
}

/** NHS App bottom navigation: one link per hub, with a filled icon for the current one. */
export function BottomNav({ screen }: { screen: Screen }) {
  const { go, t } = useJourney();
  const current = hubOf(screen);
  return (
    <nav className="app-nav" aria-label={t('nav.label')}>
      <ul className="app-nav__list">
        {(Object.keys(ICONS) as Hub[]).map(hub => (
          <li className="app-nav__item" key={hub}>
            <a
              href={`#${HUB_SCREEN[hub]}`}
              className={`app-nav__link${hub === current ? ' app-nav__link--current' : ''}`}
              aria-current={hub === current ? 'page' : undefined}
              onClick={event => { event.preventDefault(); go(HUB_SCREEN[hub], { changeFlow: undefined, editingAdditionId: undefined }); }}
            >
              <svg className="app-nav__icon" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24">
                <path d={hub === current ? ICONS[hub].filled : ICONS[hub].outline} />
              </svg>
              <span className="app-nav__label"><T k={`nav.${hub}`} /></span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** An NHS App card link. */
export function CardLink({ title, description, onSelect, icon }: { title: ReactNode; description?: ReactNode; onSelect: () => void; icon?: ReactNode }) {
  return (
    <li className="nhsapp-card">
      <div className="nhsapp-card__container">
        {icon}
        <div className="nhsapp-card__content">
          <NavLink onClick={onSelect} className="nhsapp-card__link nhsuk-link--no-visited-state">{title}</NavLink>
          {description && <div className="nhsapp-card__below"><p className="nhsapp-card__description">{description}</p></div>}
        </div>
        <svg className="nhsapp-icon nhsapp-icon--chevron-right" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" height="2rem" width="2rem" viewBox="0 0 24 24">
          <path d="M8.82 19.11a.97.97 0 0 1-.72-.31.996.996 0 0 1 .03-1.41l5.61-5.38-5.6-5.25c-.4-.38-.42-1.01-.05-1.41.38-.4 1.01-.42 1.41-.05l6.37 5.97c.2.19.31.45.32.72s-.11.54-.31.73l-6.37 6.11c-.19.19-.44.28-.69.28Z" />
        </svg>
      </div>
    </li>
  );
}

export function MessagesScreen() {
  return (
    <>
      <PageHeading><T k="messages.title" /></PageHeading>
      <p className="nhsuk-body"><T k="messages.empty" /></p>
    </>
  );
}

export function ProfileScreen() {
  const { state, go, patient } = useJourney();
  return (
    <>
      <PageHeading><T k="profile.title" /></PageHeading>
      <dl className="nhsuk-summary-list">
        <div className="nhsuk-summary-list__row">
          <dt className="nhsuk-summary-list__key"><T k="profile.name" /></dt>
          <dd className="nhsuk-summary-list__value"><Latin>{displayName(patient.name)}</Latin></dd>
        </div>
        <div className="nhsuk-summary-list__row">
          <dt className="nhsuk-summary-list__key"><T k="profile.nhsNumber" /></dt>
          <dd className="nhsuk-summary-list__value"><bdi dir="ltr">{patient.nhsNumber.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3')}</bdi></dd>
        </div>
      </dl>
      <p className="nhsuk-body"><T k="profile.lede" /></p>
      {state.saved ? (
        <ul className="nhsapp-cards nhsapp-cards--stacked">
          <CardLink title={<T k="profile.reminders" />} description={<T k="profile.remindersDetail" />} onSelect={() => go('reminders')} />
        </ul>
      ) : <p className="nhsuk-body"><T k="profile.noSchedule" /></p>}
    </>
  );
}
