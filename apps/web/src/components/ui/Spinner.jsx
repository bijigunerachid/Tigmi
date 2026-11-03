/** Loading indicator with a text alternative for screen readers. */
export function Spinner({ label, className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-8 ${className}`}>
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-2 border-accent border-e-transparent"
      />
      <span className="text-ink-muted">{label}</span>
    </div>
  );
}
