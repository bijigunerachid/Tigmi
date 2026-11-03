/**
 * Friendly "nothing here yet" block: icon (or an `illustration` element), title, explanation and
 * an optional next action.
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center px-4 py-8 text-center ${className}`}>
      {illustration && <div className="mb-2">{illustration}</div>}
      {!illustration && Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent/10 ring-1 ring-accent/25">
          <Icon aria-hidden="true" className="size-7 text-accent" />
        </span>
      )}
      {title && <p className="text-base font-semibold">{title}</p>}
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
