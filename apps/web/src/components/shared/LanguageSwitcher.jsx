import { LanguageIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage } from '../../lib/i18n.js';

/**
 * Two-option language switch. Each option is written in its own language and marked with `lang`,
 * so screen readers pronounce "العربية" correctly even on the French interface.
 */
export function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage;

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={`inline-flex items-center gap-1 rounded-full border border-line bg-canvas/60 p-1 ${className}`}
    >
      <LanguageIcon aria-hidden="true" className="ms-1.5 size-4 text-ink-subtle" />
      {SUPPORTED_LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={current === language}
          onClick={() => setLanguage(language)}
          className={`min-h-9 rounded-full px-3 text-sm transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-accent ${current === language ? 'bg-white/[0.09] font-medium text-ink' : 'text-ink-muted hover:text-ink'}`}
        >
          {t(`language.${language}`)}
        </button>
      ))}
    </div>
  );
}
