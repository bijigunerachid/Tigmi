import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Labelled input wired for accessibility: the label is a real <label>, and the hint and error are
 * announced with the field (aria-describedby / aria-invalid). Works with react-hook-form's
 * `register()` (React 19 passes `ref` as a normal prop).
 */
export function TextField({
  label,
  hint,
  error,
  type = 'text',
  className = '',
  inputClassName = '',
  ...inputProps
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`block min-h-11 w-full rounded-xl border border-white/10 bg-canvas px-3 text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 aria-invalid:border-danger ${inputClassName}`}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Password input with a show/hide toggle (more usable than a "confirm password" field). */
export function PasswordField(props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextField type={visible ? 'text' : 'password'} inputClassName="pe-12" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
        aria-pressed={visible}
        className="absolute end-1 top-[1.85rem] grid size-9 place-items-center rounded-lg text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        {visible ? (
          <EyeSlashIcon aria-hidden="true" className="size-5" />
        ) : (
          <EyeIcon aria-hidden="true" className="size-5" />
        )}
      </button>
    </div>
  );
}
