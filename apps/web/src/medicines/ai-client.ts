import {
  isAiStatusResponse, isAskResponse, isExplainResponse, isMedicineReadingResponse, isRoutineReadingResponse, isSelectionInteractionsResponse,
  type AiStatusResponse, type AskRequest, type AskResponse, type ExplainRequest, type ExplainResponse,
  type MedicineReadingRequest, type MedicineReadingResponse, type RoutineReadingResponse,
  type SelectedMedicine, type SelectionInteractionsResponse,
} from '@hackathon/api-contract';

/**
 * Calls to the API for interaction checks and AI help. AI answers are only
 * ever suggestions: the API checks each one before it is returned, and the
 * app shows its own wording whenever an answer cannot be used.
 */

export const AI_OFF: AiStatusResponse = { mode: 'off' };

async function request<T>(path: string, valid: (value: unknown) => value is T, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...init });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const body: unknown = await response.json();
  if (!valid(body)) throw new Error(`${path} returned an unexpected response`);
  return body;
}

const post = <T>(path: string, body: unknown, valid: (value: unknown) => value is T, signal?: AbortSignal) =>
  request(path, valid, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });

/** Whether AI help is available, and from which model. Treated as off if the API cannot say. */
export async function fetchAiStatus(signal?: AbortSignal): Promise<AiStatusResponse> {
  try {
    return await request('/api/ai/status', isAiStatusResponse, { signal });
  } catch {
    return AI_OFF;
  }
}

export const readMedicine = (body: MedicineReadingRequest, signal?: AbortSignal): Promise<MedicineReadingResponse> =>
  post('/api/ai/medicine', body, isMedicineReadingResponse, signal);

export const readRoutine = (text: string, signal?: AbortSignal): Promise<RoutineReadingResponse> =>
  post('/api/ai/routine', { text }, isRoutineReadingResponse, signal);

export const explainSchedule = (body: ExplainRequest, signal?: AbortSignal): Promise<ExplainResponse> =>
  post('/api/ai/explain', body, isExplainResponse, signal);

export const askSchedule = (body: AskRequest, signal?: AbortSignal): Promise<AskResponse> =>
  post('/api/ai/ask', body, isAskResponse, signal);

// Interaction checks are kept for the visit, so moving between screens does not repeat them.
const checked = new Map<string, Promise<SelectionInteractionsResponse>>();

export function checkInteractions(medicines: SelectedMedicine[]): Promise<SelectionInteractionsResponse> {
  const key = JSON.stringify(medicines);
  let result = checked.get(key);
  if (!result) {
    result = post('/api/interactions', { medicines }, isSelectionInteractionsResponse);
    checked.set(key, result);
    // A failed check can be tried again.
    result.catch(() => checked.delete(key));
  }
  return result;
}

/**
 * A photo as a JPEG of at most 1280 pixels on its longer side, base64
 * encoded. Smaller photos upload faster and are all the label needs.
 */
export async function preparePhoto(file: File): Promise<{ data: string; preview: string }> {
  const MAX = 1280;
  const image = await loadImage(file);
  const scale = Math.min(1, MAX / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot prepare the photo');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ('close' in image) image.close();
  const preview = canvas.toDataURL('image/jpeg', 0.82);
  return { data: preview.slice(preview.indexOf(',') + 1), preview };
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to an image element below */ }
  }
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Not an image'));
    image.src = url;
  });
}
