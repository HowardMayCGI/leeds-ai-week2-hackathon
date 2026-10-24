import { parseClockTime, type ClockTime } from '@hackathon/medicines';
import { en, type Messages } from './en';
import { pl } from './pl';
import { ur } from './ur';

export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr', locale: 'en-GB' },
  { code: 'pl', label: 'Polski', dir: 'ltr', locale: 'pl-PL' },
  { code: 'ur', label: 'اردو', dir: 'rtl', locale: 'ur-PK' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANGUAGE: Language = 'en';

export const CATALOGUES: Record<Language, Partial<Messages>> = { en, pl, ur };

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type MessageKey = Paths<Messages>;
export type Params = Record<string, string | number>;

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some(language => language.code === value);
}

export function languageInfo(code: Language) {
  return LANGUAGES.find(language => language.code === code)!;
}

function lookup(catalogue: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), catalogue);
  return typeof value === 'string' && value ? value : undefined;
}

export interface Translation {
  text: string;
  /** The language the text is in. English when a translation is missing. */
  lang: Language;
}

export function translate(lang: Language, key: MessageKey, params: Params = {}): Translation {
  const own = lookup(CATALOGUES[lang], key);
  const text = own ?? lookup(en, key) ?? key;
  return { text: text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)), lang: own ? lang : 'en' };
}

/** NHS style for English (7:30am), 24-hour for Polish, and the Urdu locale's own format. */
export function formatTime(value: ClockTime, lang: Language): string {
  const minutes = parseClockTime(value);
  if (minutes === null) return value;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (lang === 'en') return `${hours % 12 || 12}${mins ? `:${String(mins).padStart(2, '0')}` : ''}${hours < 12 ? 'am' : 'pm'}`;
  const date = new Date(2026, 0, 1, hours, mins);
  return new Intl.DateTimeFormat(languageInfo(lang).locale, { hour: 'numeric', minute: '2-digit', hour12: lang === 'ur' }).format(date);
}

export function formatDate(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(languageInfo(lang).locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}
