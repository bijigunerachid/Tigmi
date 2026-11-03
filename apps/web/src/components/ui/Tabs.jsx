import { useId, useRef } from 'react';

/**
 * Tabs (WAI-ARIA pattern, automatic activation): one tab stop for the whole list; arrows move
 * and select, Home/End jump. Arrow direction follows the layout direction (nearest `dir`
 * attribute, normally <html dir>), so in Arabic the left arrow goes to the NEXT tab.
 *
 * tabs: [{ id, label, content }]; controlled with `value` + `onChange`.
 */
export function Tabs({ tabs, value, onChange, label }) {
  const baseId = useId();
  const refs = useRef([]);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === value),
  );

  const select = (next) => {
    const wrapped = (next + tabs.length) % tabs.length;
    onChange(tabs[wrapped].id);
    refs.current[wrapped]?.focus();
  };

  const onKeyDown = (event) => {
    const rtl = event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    const actions = {
      [forward]: () => select(index + 1),
      [backward]: () => select(index - 1),
      Home: () => select(0),
      End: () => select(tabs.length - 1),
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  };

  const active = tabs[index];

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto rounded-[var(--radius-control)] border border-line bg-canvas/60 p-1"
      >
        {tabs.map((tab, i) => {
          const selected = i === index;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[i] = node;
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`min-h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${selected ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-ink-muted hover:text-ink'}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${baseId}-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active.id}`}
        tabIndex={0}
        className="mt-4 rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
      >
        {active.content}
      </div>
    </div>
  );
}
