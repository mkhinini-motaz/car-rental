// Laravel answers invalid input with a 422 and `{ errors: { field: [messages] } }`.
export function validationErrors(error: any): Record<string, string[]> {
  return error?.response?.status === 422 ? (error.response.data?.errors ?? {}) : {};
}

// The API refuses a booking that overlaps another contract of the same car with this message.
export const isOverlapError = (error: any) =>
  Object.values(validationErrors(error)).some(messages => messages.includes('contract:overlap'));

// The translation key that explains a failed request.
export function requestErrorKey(error: any): string {
  if (error?.code === 'ERR_NETWORK') {
    return 'network:error';
  }
  if (error?.response?.status === 403) {
    return 'common:forbidden'; // owner only
  }
  return isOverlapError(error) ? 'contract:overlap' : 'common:error:happened';
}

// Maps a 422 from the API onto form fields: "already taken" gets `takenMessage`, anything else is invalid.
export function serverFieldErrors(error: any, takenMessage = 'validation:taken'): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [ field, messages ] of Object.entries(validationErrors(error))) {
    result[field] = messages.some(message => message.includes('taken')) ? takenMessage : 'validation:invalid';
  }
  return result;
}
