import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../locales/fr/translation.json';

/**
 * French only for now; Arabic (and right-to-left layout) arrives in Phase 3 by adding
 * locales/ar/translation.json and a language switcher. Keys are shared, so no screen changes.
 */
export const SUPPORTED_LANGUAGES = ['fr'];

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false }, // React already escapes rendered text
  returnNull: false,
});

/** Translates an API error into a sentence, with a generic fallback for unknown codes. */
export function errorMessage(error) {
  const code = error?.code;
  if (code === 'ACCOUNT_LOCKED') {
    const seconds = Number(error.retryAfter) || 900;
    return i18n.t('errors.ACCOUNT_LOCKED', { minutes: Math.max(1, Math.ceil(seconds / 60)) });
  }
  return code && i18n.exists(`errors.${code}`)
    ? i18n.t(`errors.${code}`)
    : i18n.t('errors.generic');
}

/** Translates a validation code produced by the shared Zod schemas. */
export function validationMessage(code) {
  return code && i18n.exists(`validation.${code}`)
    ? i18n.t(`validation.${code}`)
    : i18n.t('validation.invalid');
}

export default i18n;
