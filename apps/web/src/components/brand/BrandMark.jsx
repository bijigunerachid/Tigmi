import { useId } from 'react';

/**
 * Tigmi's mark: a house outline ("tigmi" means house in Tamazight) lit by a blue → cyan
 * gradient, with a small window of light. Decorative: the wordmark beside it carries the name.
 */
export function BrandMark({ className = 'size-9' }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#0b1224" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}-bg)`} />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="10.5"
        fill="none"
        stroke="rgb(255 255 255 / 0.12)"
      />
      <path
        d="M10 19.5 20 11l10 8.5V29a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 10 29z"
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="17.4" y="21" width="5.2" height="5.2" rx="1.2" fill="#22d3ee" opacity="0.9" />
    </svg>
  );
}

/** Mark + "Tigmi." wordmark. The wordmark is always left-to-right, even in Arabic. */
export function BrandLockup({ size = 'md', showWordmark = true }) {
  const big = size === 'lg';
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className={big ? 'size-11' : 'size-9'} />
      {showWordmark && (
        <span dir="ltr" className={`font-semibold tracking-tight ${big ? 'text-2xl' : 'text-lg'}`}>
          Tigmi<span className="text-accent">.</span>
        </span>
      )}
    </span>
  );
}
