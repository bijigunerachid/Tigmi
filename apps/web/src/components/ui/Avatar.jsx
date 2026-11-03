const HUES = [
  ['#2563eb', '#22d3ee'],
  ['#7c3aed', '#60a5fa'],
  ['#0891b2', '#34d399'],
  ['#db2777', '#f59e0b'],
  ['#4f46e5', '#22d3ee'],
  ['#0d9488', '#a3e635'],
];

/** Stable colour per person/household: the same id always gets the same gradient. */
function hueFor(seed = '') {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)) | 0;
  return HUES[Math.abs(hash) % HUES.length];
}

/** First letters of the first two words ("Amina Benali" → "AB", "دار بنعلي" → "دب"). */
export function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => [...word][0])
    .join('')
    .toLocaleUpperCase();
}

const SIZES = {
  sm: 'size-8 text-xs rounded-lg',
  md: 'size-10 text-sm rounded-xl',
  lg: 'size-14 text-lg rounded-2xl',
};

/** Decorative initials tile — the name is always shown next to it, so it is aria-hidden. */
export function Avatar({ name, seed, size = 'md', className = '' }) {
  const [from, to] = hueFor(seed ?? name);
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ${SIZES[size]} ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials(name)}
    </span>
  );
}
