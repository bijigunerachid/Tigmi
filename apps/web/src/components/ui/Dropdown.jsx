import { CheckIcon } from '@heroicons/react/20/solid';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button.jsx';

/**
 * Menu button (WAI-ARIA "menu button" pattern):
 *  - Enter/Space/ArrowDown on the button opens the menu on the first item, ArrowUp on the last;
 *  - ArrowUp/ArrowDown move between items, Home/End jump, typing a letter jumps to that item;
 *  - Escape closes and returns focus to the button; Tab or a click outside closes.
 *
 * items: [{ id, label, icon?, onSelect, tone?: 'danger', disabled?, checked?, lang? }]
 *   `checked` (true/false) turns the item into a radio choice (role="menuitemradio").
 * side: 'bottom' (default) or 'top' for menus near the bottom of the screen.
 */
export function Dropdown({
  label,
  items,
  triggerContent,
  triggerProps = {},
  align = 'end',
  side = 'bottom',
  fullWidth = false,
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef(null);
  const containerRef = useRef(null);
  const itemRefs = useRef([]);

  const enabled = items.map((item, index) => (item.disabled ? -1 : index)).filter((i) => i >= 0);
  const focusItem = useCallback((index) => itemRefs.current[index]?.focus(), []);

  const openAt = (position) => {
    setOpen(true);
    // Wait for the menu to render before moving focus into it.
    requestAnimationFrame(() => focusItem(position === 'last' ? enabled.at(-1) : enabled[0]));
  };

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const onMenuKeyDown = (event) => {
    const current = enabled.indexOf(itemRefs.current.indexOf(document.activeElement));
    const move = (to) => {
      event.preventDefault();
      focusItem(enabled[(to + enabled.length) % enabled.length]);
    };
    if (event.key === 'ArrowDown') move(current + 1);
    else if (event.key === 'ArrowUp') move(current - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(enabled.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') close(false);
    else if (event.key.length === 1) {
      const letter = event.key.toLocaleLowerCase();
      const match = enabled.find((i) =>
        String(items[i].label).toLocaleLowerCase().startsWith(letter),
      );
      if (match !== undefined) focusItem(match);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? 'block w-full' : 'inline-block'}`}>
      <Button
        ref={buttonRef}
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? close() : openAt('first'))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openAt('first');
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openAt('last');
          }
        }}
        {...triggerProps}
      >
        {triggerContent}
      </Button>

      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`absolute z-[var(--z-dropdown)] min-w-48 animate-rise-in ${side === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'} rounded-[var(--radius-control)] border border-line bg-raised p-1 shadow-[var(--shadow-raised)] ${align === 'end' ? 'end-0' : 'start-0'}`}
        >
          {items.map((item, index) => (
            <li key={item.id} role="none">
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                lang={item.lang}
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm outline-none hover:bg-white/[0.06] focus:bg-white/[0.08] disabled:opacity-50 ${item.tone === 'danger' ? 'text-danger' : 'text-ink'}`}
              >
                {item.icon && <item.icon aria-hidden="true" className="size-5 shrink-0" />}
                <span className="flex-1">{item.label}</span>
                {item.checked && <CheckIcon aria-hidden="true" className="size-4 text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
