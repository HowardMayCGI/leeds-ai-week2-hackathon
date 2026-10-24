import type { Answers } from '@hackathon/medicines';

/**
 * The usual day of some test patients, so their routine questions start
 * filled in and can be confirmed with Continue. The patient can still change
 * any answer. Times are 24-hour FHIR-style "HH:MM" values, keyed by NHS number.
 */
const USUAL_DAYS: Record<string, Answers> = {
  // Lilliana Kimbra Lockman
  '9997111249': { 'wake-time': '07:00', 'sleep-time': '22:30', 'breakfast-time': '08:00', 'lunch-time': '13:00', 'dinner-time': '18:30' },
  // Gene Orval Witting: an early riser
  '9993689246': { 'wake-time': '06:30', 'sleep-time': '21:30', 'breakfast-time': '07:30', 'lunch-time': '12:30', 'dinner-time': '17:30' },
  // Raylene Loriann Ledner: a later start
  '9991789243': { 'wake-time': '08:00', 'sleep-time': '23:00', 'breakfast-time': '09:00', 'lunch-time': '13:00', 'dinner-time': '18:00' },
};

export function usualDay(nhsNumber: string): Answers | undefined {
  return USUAL_DAYS[nhsNumber];
}
