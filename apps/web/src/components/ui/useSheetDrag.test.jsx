import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Modal } from './Dialog.jsx';

/** Phone layout + pointer capture (missing in jsdom) + a controllable clock. */
function setup() {
  vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('max-width: 639px') }));
  Element.prototype.setPointerCapture ??= () => {};
  // jsdom has no layout: give the sheet a realistic height (30 % = 120 px).
  vi.spyOn(HTMLDialogElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 400 });
  let now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const onClose = vi.fn();
  render(
    <Modal open onClose={onClose} title="Nouvelle dépense">
      <p>Contenu</p>
    </Modal>,
  );
  const header = screen.getByRole('heading', { name: 'Nouvelle dépense' }).closest('header');
  const drag = (distance, durationMs) => {
    fireEvent.pointerDown(header, { pointerId: 1, clientY: 100 });
    now += durationMs;
    fireEvent.pointerMove(header, { pointerId: 1, clientY: 100 + distance });
    fireEvent.pointerUp(header, { pointerId: 1, clientY: 100 + distance });
  };
  return { onClose, drag };
}

describe('bottom sheet swipe-to-close', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes on a quick flick even over a short distance (velocity > 0.11 px/ms)', () => {
    const { onClose, drag } = setup();
    drag(40, 100); // 0.4 px/ms
    act(() => vi.advanceTimersByTime(250));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back after a short, slow drag', () => {
    const { onClose, drag } = setup();
    drag(40, 1000); // 0.04 px/ms, and far from 30 % of the height
    act(() => vi.advanceTimersByTime(250));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores upward drags', () => {
    const { onClose, drag } = setup();
    drag(-120, 80);
    act(() => vi.advanceTimersByTime(250));
    expect(onClose).not.toHaveBeenCalled();
  });
});
