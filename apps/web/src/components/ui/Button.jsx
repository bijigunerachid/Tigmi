import { Link } from 'react-router';
import { buttonClasses } from './variants.js';

function Busy() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent"
    />
  );
}

/**
 * Accessible button. `loading` keeps it disabled (no double submission) and can swap the label.
 * `size="icon"` is a square 44px icon button: give it an `aria-label`.
 */
export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  loadingLabel,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClasses({ variant, size, fullWidth })} ${className}`}
      {...props}
    >
      {loading && <Busy />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/** A router link that looks exactly like a Button (same variants and sizes). */
export function ButtonLink({ variant, size, fullWidth, className = '', children, ...props }) {
  return (
    <Link className={`${buttonClasses({ variant, size, fullWidth })} ${className}`} {...props}>
      {children}
    </Link>
  );
}
