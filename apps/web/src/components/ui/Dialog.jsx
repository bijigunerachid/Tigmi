import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useId, useRef } from 'react';
import { useSheetDrag } from './useSheetDrag.js';
import { useTranslation } from 'react-i18next';
import { Button } from './Button.jsx';

const LAYOUTS = {
  // Centered on tablets and desktops; on phones, a bottom sheet you can swipe down to close.
  center:
    'm-auto w-[calc(100%-2rem)] rounded-[var(--radius-dialog)] animate-rise-in max-h-[calc(100dvh-2rem)] ' +
    'max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:animate-sheet-up ' +
    'max-sm:max-h-[88dvh] max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)]',
  drawer:
    'my-0 ms-auto me-0 h-dvh max-h-dvh w-full max-w-md rounded-none sm:rounded-s-[var(--radius-dialog)] animate-slide-in-end',
};
const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

/**
 * Shared base of Modal and Drawer, built on the native <dialog> element with showModal():
 * the browser traps focus inside, makes the page behind inert, closes on Escape and returns focus
 * to the element that opened it. React state (`open`) stays the single source of truth.
 */
function DialogBase({ open, onClose, title, description, children, footer, layout, size = 'md' }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const drag = useSheetDrag({ dialogRef: ref, onClose, enabled: layout === 'center' });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Initial focus: an element marked data-autofocus, else the browser's default (first control).
      dialog.querySelector('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Escape: let React decide (keeps `open` in sync), instead of the browser closing alone.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the dimmed area outside the panel targets the <dialog> itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`border border-line bg-raised p-0 text-ink shadow-[var(--shadow-raised)] backdrop:animate-fade-in ${LAYOUTS[layout]} ${layout === 'center' ? WIDTHS[size] : ''}`}
    >
      {open && (
        // The rim highlight lives on the inner panel: `rim` sets position: relative, which must
        // never apply to the <dialog> itself (it is fixed in the browser top layer).
        <div className="rim flex max-h-[inherit] flex-col rounded-[inherit]">
          {layout === 'center' && (
            // Grab handle (phones): a visual cue that the sheet can be swiped down.
            <div {...drag} className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
          )}
          <header
            {...(layout === 'center' ? drag : {})}
            className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 max-sm:touch-none"
          >
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t('ui.close')}
              className="-me-2 -mt-1"
            >
              <XMarkIcon aria-hidden="true" className="size-5" />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

/** Centered dialog for short tasks and confirmations. */
export function Modal(props) {
  return <DialogBase layout="center" {...props} />;
}

/** Side panel sliding from the end edge (right in French, left in Arabic) for longer forms. */
export function Drawer(props) {
  return <DialogBase layout="drawer" {...props} />;
}

/**
 * "Are you sure?" dialog. Focus starts on Cancel, so pressing Enter by reflex never destroys
 * anything (data-autofocus). `onConfirm` may be async: the button shows progress and the dialog stays open on error.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading = false,
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading} data-autofocus>
            {cancelLabel ?? t('ui.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger-solid' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel ?? t('ui.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-ink-muted">{message}</p>
    </Modal>
  );
}
