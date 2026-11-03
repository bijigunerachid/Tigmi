const TONES = {
  neutral: 'bg-white/[0.06] text-ink ring-line-strong',
  brand: 'bg-brand/15 text-blue-200 ring-brand/40',
  accent: 'bg-accent/10 text-accent ring-accent/30',
  success: 'bg-success/10 text-success ring-success/30',
  warning: 'bg-warning/10 text-warning ring-warning/30',
  danger: 'bg-danger/10 text-danger ring-danger/30',
};

/** Small status label. Colour is never the only signal: the text always says the status. */
export function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
