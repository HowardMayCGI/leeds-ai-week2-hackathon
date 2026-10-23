export interface RandomNumberResponse {
  number: number;
}

export function isRandomNumberResponse(value: unknown): value is RandomNumberResponse {
  if (typeof value !== 'object' || value === null || !('number' in value)) return false;
  return typeof value.number === 'number' && Number.isInteger(value.number) && value.number >= 1 && value.number <= 100;
}
