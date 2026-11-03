const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand/90',
  secondary: 'border border-white/10 bg-white/5 text-ink hover:bg-white/10',
  ghost: 'text-ink-muted hover:bg-white/5 hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

/**
 * Accessible button: 44px minimum touch target, visible focus ring, and `loading` shows a label
 * while keeping the button disabled so forms cannot be submitted twice.
 */
export function Button({
  variant = 'primary',
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent"
        />
      )}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
