import {
  createProposal, initialAnswers, needsDetails, toRoutine,
  type Answers, type PatientAddition, type Proposal, type QuestionnaireResponse, type RecordDetails, type RecordMedicine,
} from '@hackathon/medicines';
import { isLanguage, type Language } from './i18n';

export type Screen =
  | 'prescriptions' | 'intro' | 'waking-sleeping' | 'meal-times' | 'medicines' | 'record-details' | 'additions' | 'addition-form' | 'addition-timing'
  | 'check' | 'proposal' | 'saved-confirmation' | 'schedule' | 'reminders' | 'review-confirmation'
  | 'messages' | 'profile';

/** Inputs to one proposal. Language independent, so switching language never changes them. */
export interface Draft {
  answers: Answers;
  selected: string[];
  /** The patient chose "None of these" for their record medicines. */
  noneSelected: boolean;
  /** How the patient takes record medicines whose record has no dose or frequency, by record id. */
  recordDetails: Record<string, RecordDetails>;
  additions: PatientAddition[];
}

export type Permission = 'not-requested' | 'granted' | 'denied';

export interface SavedSchedule {
  version: 3;
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
  /** The record medicine whose details the patient is giving. */
  editingRecordId?: string;
  saved?: SavedSchedule;
}

export function emptyDraft(): Draft {
  return { answers: initialAnswers(), selected: [], noneSelected: false, recordDetails: {}, additions: [] };
}

export function initialState(): State {
  return { screen: 'prescriptions', draft: emptyDraft(), updating: false };
}

export function proposalFor(draft: Draft, record: RecordMedicine[]): Proposal | undefined {
  const routine = toRoutine(draft.answers);
  if (!routine) return undefined;
  return createProposal({ routine, record, selectedRecordIds: draft.selected, additions: draft.additions, recordDetails: draft.recordDetails });
}

/** The next selected record medicine the patient still needs to tell us about, in record order. */
export function nextPendingDetails(draft: Draft, record: RecordMedicine[], after?: string): string | undefined {
  const start = after ? record.findIndex(medicine => medicine.id === after) + 1 : 0;
  return record.slice(start).find(medicine => draft.selected.includes(medicine.id) && needsDetails(medicine) && !draft.recordDetails[medicine.id])?.id;
}

// ---------------------------------------------------------------------------
// Device storage. The language and patient choices are per-device
// conveniences. Each patient's saved schedule is kept on the device until API
// persistence is added.
// ---------------------------------------------------------------------------

const LANGUAGE_KEY = 'lai-app:language';
const PATIENT_KEY = 'lai-app:patient';
const savedKey = (patient: string) => `lai-app:medicines:saved-schedule:${patient}`;

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

export function loadPatient(): string | undefined {
  try {
    return storage()?.getItem(PATIENT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storePatient(patient: string) {
  try { storage()?.setItem(PATIENT_KEY, patient); } catch { /* preference is optional */ }
}

export function loadSaved(patient: string): SavedSchedule | undefined {
  try {
    const value = JSON.parse(storage()?.getItem(savedKey(patient)) ?? 'null') as SavedSchedule | null;
    return value?.version === 3 && value.proposal?.status === 'ok' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function storeSaved(patient: string, saved: SavedSchedule | undefined) {
  try {
    if (saved) storage()?.setItem(savedKey(patient), JSON.stringify(saved));
    else storage()?.removeItem(savedKey(patient));
  } catch { /* the schedule still works for this visit */ }
}

/** Forgets everything this device remembers about the patient, as for a new user. */
export function clearDevice(patient: string) {
  storeSaved(patient, undefined);
}
