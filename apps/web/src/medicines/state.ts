import {
  createProposal, initialAnswers, PATIENT_RECORD, toRoutine,
  type Answers, type PatientAddition, type Proposal, type QuestionnaireResponse,
} from '@hackathon/medicines';
import { isLanguage, type Language } from './i18n';

export type Screen =
  | 'prescriptions' | 'intro' | 'waking-sleeping' | 'meal-times' | 'medicines' | 'additions' | 'addition-form'
  | 'check' | 'proposal' | 'saved-confirmation' | 'schedule' | 'reminders' | 'review-confirmation'
  | 'messages' | 'profile';

/** Inputs to one proposal. Language independent, so switching language never changes them. */
export interface Draft {
  answers: Answers;
  selected: string[];
  /** The patient chose "None of these" for their record medicines. */
  noneSelected: boolean;
  additions: PatientAddition[];
}

export type Permission = 'not-requested' | 'granted' | 'denied';

export interface SavedSchedule {
  version: 2;
  savedAt: string;
  draft: Draft;
  response: QuestionnaireResponse;
  proposal: Extract<Proposal, { status: 'ok' }>;
  reminders: { enabled: boolean; permission: Permission };
  reviewRequestedAt?: string;
}

/** A detour from check answers (or a proposal or saved schedule) through some screens and back. */
export interface ChangeFlow {
  start: Screen;
  end: Screen;
  origin: Screen;
}

export interface State {
  screen: Screen;
  draft: Draft;
  /** True while changing a saved schedule; the saved one stays in use until replaced. */
  updating: boolean;
  proposal?: Proposal;
  changeFlow?: ChangeFlow;
  editingAdditionId?: string;
  saved?: SavedSchedule;
}

export function emptyDraft(): Draft {
  return { answers: initialAnswers(), selected: [], noneSelected: false, additions: [] };
}

export function initialState(): State {
  return { screen: 'prescriptions', draft: emptyDraft(), updating: false };
}

export function proposalFor(draft: Draft): Proposal | undefined {
  const routine = toRoutine(draft.answers);
  if (!routine) return undefined;
  return createProposal({ routine, record: PATIENT_RECORD, selectedRecordIds: draft.selected, additions: draft.additions });
}

// ---------------------------------------------------------------------------
// Device storage. The language preference is a per-device convenience. The
// saved schedule is kept on the device until API persistence is added.
// ---------------------------------------------------------------------------

const LANGUAGE_KEY = 'lai-app:language';
const SAVED_KEY = 'lai-app:medicines:saved-schedule';

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadLanguage(): Language | undefined {
  try {
    const value = storage()?.getItem(LANGUAGE_KEY);
    return isLanguage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function storeLanguage(language: Language) {
  try { storage()?.setItem(LANGUAGE_KEY, language); } catch { /* preference is optional */ }
}

export function loadSaved(): SavedSchedule | undefined {
  try {
    const value = JSON.parse(storage()?.getItem(SAVED_KEY) ?? 'null') as SavedSchedule | null;
    return value?.version === 2 && value.proposal?.status === 'ok' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function storeSaved(saved: SavedSchedule | undefined) {
  try {
    if (saved) storage()?.setItem(SAVED_KEY, JSON.stringify(saved));
    else storage()?.removeItem(SAVED_KEY);
  } catch { /* the schedule still works for this visit */ }
}

/** Forgets everything this device remembers about the patient, as for a new user. */
export function clearDevice() {
  storeSaved(undefined);
}
