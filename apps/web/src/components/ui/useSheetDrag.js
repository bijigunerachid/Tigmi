import { useRef } from 'react';

const VELOCITY_TO_DISMISS = 0.11; // px per ms: a quick flick closes, whatever the distance
const DISTANCE_TO_DISMISS = 0.3; // or dragging past 30 % of the sheet height
const SETTLE = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)';

const isPhone = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches;

/**
 * Swipe-down-to-close for bottom sheets (phones only). Returns pointer handlers to spread on the
 * draggable area (grab handle + header).
 *  - follows the finger 1:1 downward; upward drags meet increasing resistance (no hard wall);
 *  - releases with enough velocity OR distance dismiss, otherwise the sheet springs back;
 *  - pointer capture keeps tracking even if the finger leaves the header;
 *  - extra fingers are ignored while a drag is in progress.
 * Transforms are written directly on the element (no React state per frame).
 */
export function useSheetDrag({ dialogRef, onClose, enabled }) {
  const drag = useRef(null);

  if (!enabled) return {};

  const setTransform = (value, transition = 'none') => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.style.transition = transition;
    dialog.style.transform = value;
  };

  return {
    onPointerDown(event) {
      if (!isPhone() || drag.current || event.target.closest('button, a, input, select, textarea'))
        return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        id: event.pointerId,
        startY: event.clientY,
        startTime: performance.now(),
        dy: 0,
      };
    },
    onPointerMove(event) {
      const state = drag.current;
      if (!state || event.pointerId !== state.id) return;
      const raw = event.clientY - state.startY;
      // Downward: 1:1. Upward: damped, the further you pull the less it moves.
      state.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
      setTransform(`translateY(${state.dy}px)`);
    },
    onPointerUp(event) {
      const state = drag.current;
      if (!state || event.pointerId !== state.id) return;
      drag.current = null;
      const dialog = dialogRef.current;
      const height = dialog?.getBoundingClientRect().height || 1;
      const velocity = state.dy / Math.max(1, performance.now() - state.startTime);
      if (
        state.dy > 0 &&
        (velocity > VELOCITY_TO_DISMISS || state.dy > height * DISTANCE_TO_DISMISS)
      ) {
        setTransform('translateY(100%)', SETTLE);
        window.setTimeout(() => {
          setTransform('');
          onClose();
        }, 200);
      } else {
        setTransform('', SETTLE);
      }
    },
    onPointerCancel() {
      drag.current = null;
      setTransform('', SETTLE);
    },
  };
}
