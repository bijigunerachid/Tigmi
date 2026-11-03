import { cloneElement, useEffect, useId, useState } from 'react';

/**
 * Short hint shown on hover AND keyboard focus, announced through aria-describedby, dismissable
 * with Escape (WCAG 1.4.13). Never put essential information only in a tooltip: touch screens
 * have no hover. `children` must be a single focusable element.
 */
export function Tooltip({ content, children, side = 'top' }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);
  const describedBy = [children.props['aria-describedby'], id].filter(Boolean).join(' ');

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {cloneElement(children, {
        'aria-describedby': describedBy,
        // Keep the child's own handlers: cloneElement would otherwise replace them.
        onFocus: (event) => {
          children.props.onFocus?.(event);
          show();
        },
        onBlur: (event) => {
          children.props.onBlur?.(event);
          hide();
        },
      })}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute start-1/2 z-[var(--z-tooltip)] w-max max-w-60 -translate-x-1/2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs text-ink shadow-[var(--shadow-raised)] transition-opacity duration-150 rtl:translate-x-1/2 ${side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {content}
      </span>
    </span>
  );
}
