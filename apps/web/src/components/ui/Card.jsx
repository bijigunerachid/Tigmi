/** Surface used for every panel. `as` lets a card be a <section>, <article>, etc. */
export function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag
      className={`rounded-2xl border border-white/5 bg-surface p-6 shadow-xl shadow-black/30 ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
