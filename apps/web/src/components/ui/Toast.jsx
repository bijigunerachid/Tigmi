import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

const ToastContext = createContext(null);
const ICONS = {
  success: CheckCircleIcon,
  error: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};
const TONES = { success: 'text-success', error: 'text-danger', info: 'text-info' };
const DURATION_MS = 5000;

function ToastItem({ toast, onDismiss }) {
  const { t } = useTranslation();
  const timer = useRef(null);
  const Icon = ICONS[toast.tone];

  const start = useCallback(() => {
    timer.current = setTimeout(() => onDismiss(toast.id), toast.duration);
  }, [onDismiss, toast.id, toast.duration]);
  const stop = () => clearTimeout(timer.current);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <li
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
      className="pointer-events-auto flex w-full animate-rise-in items-start gap-3 rounded-[var(--radius-control)] border border-line bg-raised p-4 shadow-[var(--shadow-raised)]"
    >
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${TONES[toast.tone]}`} />
      <p className="min-w-0 flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('ui.toast.dismiss')}
        className="-m-1 grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <XMarkIcon aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

/**
 * Short confirmations ("Invitation envoyée"). They pause while hovered or focused (WCAG 2.2.1),
 * and important errors should also stay visible on the page, not only in a toast.
 */
export function ToastProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((item) => item.id !== id)), []);
  const show = useCallback((tone, message, duration = DURATION_MS) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((all) => [...all.slice(-2), { id, tone, message, duration }]); // at most 3
    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (message, duration) => show('success', message, duration),
      error: (message, duration) => show('error', message, duration),
      info: (message, duration) => show('info', message, duration),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region exists before any toast: screen readers then announce each new one. */}
      {/* Below the desktop breakpoint, toasts sit above the floating bottom navigation bar. */}
      <ol
        aria-live="polite"
        aria-label={t('ui.toast.region')}
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[var(--z-toast)] flex flex-col gap-2 sm:inset-x-auto sm:end-6 sm:w-96 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </ol>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
