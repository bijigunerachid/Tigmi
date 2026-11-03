import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FIELD_CLASSES } from './variants.js';

/** Label + control + hint/error, with the accessibility wiring shared by every field type. */
export function Field({ label, hint, error, className = '', children }) {
  const id = useId();
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hintId && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Labelled input. Works with react-hook-form's `register()` (React 19 passes `ref` as a prop).
 * `endAdornment` renders inside the input on the end side (right in French, left in Arabic).
 */
export function TextField({
  label,
  hint,
  error,
  type = 'text',
  className = '',
  inputClassName = '',
  endAdornment,
  ...inputProps
}) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <div className="relative">
          <input
            type={type}
            className={`${FIELD_CLASSES} ${endAdornment ? 'pe-12' : ''} ${inputClassName}`}
            {...a11y}
            {...inputProps}
          />
          {endAdornment && (
            <div className="absolute inset-y-0 end-1 flex items-center">{endAdornment}</div>
          )}
        </div>
      )}
    </Field>
  );
}

/** Password input with a show/hide toggle (more usable than a "confirm password" field). */
export function PasswordField(props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
          aria-pressed={visible}
          className="grid size-9 place-items-center rounded-lg text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {visible ? (
            <EyeSlashIcon aria-hidden="true" className="size-5" />
          ) : (
            <EyeIcon aria-hidden="true" className="size-5" />
          )}
        </button>
      }
      {...props}
    />
  );
}

/**
 * Date field using the browser's native picker: localised by the browser, keyboard accessible,
 * and it opens the phone's own date wheel on mobile. Value format is always YYYY-MM-DD.
 */
export function DatePicker(props) {
  return <TextField type="date" inputClassName="[color-scheme:dark]" {...props} />;
}

export function TextArea({ label, hint, error, className = '', rows = 4, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <textarea rows={rows} className={`${FIELD_CLASSES} py-2.5`} {...a11y} {...props} />
      )}
    </Field>
  );
}
