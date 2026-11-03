const TONES = {
  info: 'border-accent/30 bg-accent/10 text-ink',
  success: 'border-success/30 bg-success/10 text-ink',
  error: 'border-danger/40 bg-danger/10 text-ink',
};

/**
 * Message box. Errors use role="alert" (announced immediately by screen readers);
 * other tones use role="status" (announced politely).
 */
export function Alert({ tone = 'info', children, className = '' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
