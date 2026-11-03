import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useLinkToken } from '../../hooks/useLinkToken.js';
import { errorMessage } from '../../lib/i18n.js';
import { verifyEmail } from './auth-api.js';

const linkClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Opened from the verification email: /verify-email#token=… */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { token } = useLinkToken();
  const [state, setState] = useState(() => ({ status: token ? 'working' : 'missing' }));
  const started = useRef(false);

  useEffect(() => {
    // The token is single-use: never send it twice (React runs effects twice in development).
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(() => setState({ status: 'success' }))
      .catch((error) => setState({ status: 'failed', error }));
  }, [token]);

  return (
    <Card as="section" aria-labelledby="verify-title" className="text-center">
      <h1 id="verify-title" className="text-2xl font-semibold">
        {t('auth.verify.title')}
      </h1>
      <div aria-live="polite" className="mt-4">
        {state.status === 'working' && <Spinner label={t('auth.verify.working')} />}

        {state.status === 'success' && (
          <div className="space-y-6">
            <CheckCircleIcon aria-hidden="true" className="mx-auto size-12 text-success" />
            <p role="status">{t('auth.verify.success')}</p>
            <Link to="/login" className={linkClass}>
              {t('common.signIn')}
            </Link>
          </div>
        )}

        {(state.status === 'failed' || state.status === 'missing') && (
          <div className="space-y-6">
            <ExclamationTriangleIcon aria-hidden="true" className="mx-auto size-12 text-warning" />
            <p role="alert">
              {state.status === 'missing'
                ? t('auth.verify.missingToken')
                : state.error?.code === 'INVALID_OR_EXPIRED_TOKEN'
                  ? t('auth.verify.failed')
                  : errorMessage(state.error)}
            </p>
            <Link to="/login" className={linkClass}>
              {t('auth.verify.requestNew')}
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
