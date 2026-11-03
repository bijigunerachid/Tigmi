import { useId } from 'react';

/** Native <select> with a real label: accessible and comfortable on phones. */
export function SelectField({ label, error, options, className = '', ...selectProps }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className="block min-h-11 w-full rounded-xl border border-white/10 bg-canvas px-3 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
