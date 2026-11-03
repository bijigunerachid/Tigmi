/** Surface used for every panel. `as` lets a card be a <section>, <article>, etc. */
export function Card({ as: Tag = 'div', padded = true, className = '', children, ...props }) {
  return (
    <Tag
      className={`rim rounded-[var(--radius-card)] border border-line bg-surface/85 shadow-[var(--shadow-card)] ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * Card heading row: title (+ optional description) on one side, actions on the other.
 * Pass `titleId` and use it as the card's aria-labelledby.
 */
export function CardHeader({ title, titleId, description, actions, as: Heading = 'h2' }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Heading id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </Heading>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
