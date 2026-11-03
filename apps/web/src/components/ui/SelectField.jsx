import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { Field } from './TextField.jsx';
import { FIELD_CLASSES } from './variants.js';

/** Native <select> (accessible, comfortable on phones) with a themed chevron on the end side. */
export function SelectField({ label, hint, error, options, className = '', ...selectProps }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <div className="relative">
          <select className={`${FIELD_CLASSES} appearance-none pe-10`} {...a11y} {...selectProps}>
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-surface">
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 end-3 my-auto size-5 text-ink-muted"
          />
        </div>
      )}
    </Field>
  );
}
