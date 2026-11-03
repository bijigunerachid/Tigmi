import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { errorMessage } from '../../lib/i18n.js';
import { resendVerification } from './auth-api.js';

export function CheckEmailPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = location.state?.email;
  const next = params.get('next');
  const [state, setState] = useState({ status: 'idle', error: null });

  const resend = async () => {
    setState({ status: 'sending', error: null });
    try {
      await resendVerification(email);
      setState({ status: 'sent', error: null });
    } catch (error) {
      setState({ status: 'idle', error });
    }
  };

  return (
    <Card as="section" aria-labelledby="check-title" className="text-center">
      <EnvelopeIcon aria-hidden="true" className="mx-auto size-12 text-accent" />
      <h1 id="check-title" className="mt-4 text-2xl font-semibold">
        {t('auth.checkEmail.title')}
      </h1>
      <p className="mt-3 leading-relaxed text-ink-muted">
        {email ? t('auth.checkEmail.body', { email }) : t('auth.checkEmail.bodyNoEmail')}
      </p>
      <p className="mt-2 text-sm text-ink-muted">{t('auth.checkEmail.spam')}</p>

      <div className="mt-6 space-y-3">
        {state.status === 'sent' && <Alert tone="success">{t('auth.checkEmail.resent')}</Alert>}
        {state.error && <Alert tone="error">{errorMessage(state.error)}</Alert>}
        {email && state.status !== 'sent' && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={resend}
            loading={state.status === 'sending'}
          >
            {t('auth.checkEmail.resend')}
          </Button>
        )}
        <Link
          to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('auth.checkEmail.toLogin')}
        </Link>
      </div>
    </Card>
  );
}
