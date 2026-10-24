/** A wall-clock time in 24-hour `HH:MM` form, independent of display language. */
export type ClockTime = string;

export const MINUTES_PER_DAY = 24 * 60;

export function parseClockTime(value: string | undefined | null): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Formats minutes as `HH:MM`, wrapping times after midnight back into the 24-hour clock. */
export function formatClockTime(minutes: number): ClockTime {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** FHIR `time` values are `HH:MM:SS`. */
export function toFhirTime(value: ClockTime): string {
  return `${value}:00`;
}

export function fromFhirTime(value: string): ClockTime | null {
  const minutes = parseClockTime(value);
  return minutes === null ? null : formatClockTime(minutes);
}
