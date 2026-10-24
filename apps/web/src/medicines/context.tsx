'use client';

import { createContext, useContext } from 'react';
import type { MessageKey, Language, Params, Translation } from './i18n';
import type { ChangeFlow, Draft, Screen, State } from './state';

export interface Journey {
  state: State;
  lang: Language;
  t: (key: MessageKey, params?: Params) => string;
  tr: (key: MessageKey, params?: Params) => Translation;
  time: (value: string) => string;
  date: (iso: string) => string;
  go: (screen: Screen, changes?: Partial<State>) => void;
  updateDraft: (update: (draft: Draft) => Draft) => void;
  setState: (update: (state: State) => State) => void;
  /** Moves on from a question screen, returning to check answers at the end of a change. */
  next: (from: Screen, to: Screen) => void;
  /** Where the Back link goes from a question screen. */
  back: (from: Screen, previous: Screen) => Screen;
  startChange: (flow: ChangeFlow) => void;
}

export const JourneyContext = createContext<Journey | null>(null);

export function useJourney(): Journey {
  const journey = useContext(JourneyContext);
  if (!journey) throw new Error('useJourney must be used inside the medicines journey');
  return journey;
}
