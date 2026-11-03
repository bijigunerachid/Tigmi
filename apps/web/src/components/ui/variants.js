/**
 * Shared class recipes, so a <button> and a link that looks like a button stay identical.
 */
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out)] select-none ' +
  // Press feedback: a subtle squeeze confirms the tap (not when disabled).
  'active:scale-[0.97] disabled:active:scale-100 aria-disabled:active:scale-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55';

const BUTTON_VARIANTS = {
  primary:
    'bg-[linear-gradient(180deg,#3b82f6,#2563eb)] text-white shadow-[0_1px_0_rgb(255_255_255/0.22)_inset,0_10px_24px_-10px_rgb(37_99_235/0.9)] hover:bg-[linear-gradient(180deg,#2563eb,#1d4ed8)]',
  secondary: 'border border-line-strong bg-white/[0.04] text-ink hover:bg-white/[0.08]',
  ghost: 'text-ink-muted hover:bg-white/[0.06] hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
  'danger-solid': 'bg-red-600 text-white hover:bg-red-700',
};

const BUTTON_SIZES = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4',
  lg: 'min-h-12 px-5 text-lg',
  icon: 'size-11 shrink-0',
};

export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false } = {}) {
  return [BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], fullWidth && 'w-full']
    .filter(Boolean)
    .join(' ');
}

/** Shared look of text inputs, selects and date fields. */
export const FIELD_CLASSES =
  'block min-h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-canvas/80 px-3 ' +
  'text-ink placeholder:text-ink-subtle transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-ink-subtle/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35 ' +
  'aria-invalid:border-danger aria-invalid:focus:ring-danger/30 disabled:opacity-55';
