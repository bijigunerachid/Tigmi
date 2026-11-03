/**
 * Placeholder shapes shown while content loads. Hidden from screen readers: pair them with a
 * text status (e.g. LoadingSpinner's label or aria-busy) so loading is still announced.
 */
export function Skeleton({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-shimmer rounded-md bg-[linear-gradient(90deg,rgb(255_255_255/0.04)_25%,rgb(255_255_255/0.09)_50%,rgb(255_255_255/0.04)_75%)] bg-[length:200%_100%] ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3 }) {
  return (
    <span aria-hidden="true" className="block space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-4 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </span>
  );
}
