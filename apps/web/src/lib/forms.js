import { errorMessage, validationMessage } from './i18n.js';

/**
 * Shows an API error on a react-hook-form form: per-field codes from VALIDATION_ERROR go under
 * their fields; anything else becomes the form-level message (`errors.root.server`).
 */
export function applyApiError(error, setError) {
  const details = error?.code === 'VALIDATION_ERROR' ? error.payload?.error?.details : null;
  const fieldErrors = Array.isArray(details) ? details.filter((d) => d.field) : [];
  if (fieldErrors.length > 0) {
    for (const { field, code } of fieldErrors) {
      setError(field, { type: 'server', message: code });
    }
    return;
  }
  setError('root.server', { type: 'server', message: errorMessage(error) });
}

/** Translated message for a field error (messages are validation codes like "too_short"). */
export const fieldError = (error) => (error ? validationMessage(error.message) : undefined);
