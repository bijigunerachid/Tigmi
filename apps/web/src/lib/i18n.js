import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '../locales/ar/translation.json';
import fr from '../locales/fr/translation.json';

export const SUPPORTED_LANGUAGES = ['fr', 'ar'];
const STORAGE_KEY = 'tigmi.language';

/** Locale used by Intl for numbers, currency and dates (Moroccan conventions, Latin digits). */
const INTL_LOCALES = { fr: 'fr-MA', ar: 'ar-MA' };
export const intlLocale = (language = i18n.language) => INTL_LOCALES[language] ?? 'fr-MA';

function storedLanguage() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(value) ? value : null;
  } catch {
    return null; // storage blocked (private mode): fall back to the browser language
  }
}

/** Explicit choice first, then the browser's language, then French. */
function initialLanguage() {
  const stored = storedLanguage();
  if (stored) return stored;
  const browser = typeof navigator === 'undefined' ? '' : navigator.language;
  return browser?.toLowerCase().startsWith('ar') ? 'ar' : 'fr';
}

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar } },
  lng: initialLanguage(),
  fallbackLng: 'fr',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false }, // React already escapes rendered text
  returnNull: false,
});

/** True once the person picked a language on this device (it then wins over account defaults). */
export const hasChosenLanguage = () => storedLanguage() !== null;

/** Switches language (layout direction follows) and remembers the choice on this device. */
export function setLanguage(language, { remember = true } = {}) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return;
  if (remember) {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // the choice still applies for this visit
    }
  }
  i18n.changeLanguage(language);
}

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
