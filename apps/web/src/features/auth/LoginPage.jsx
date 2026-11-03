import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@tigmi/validation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { PasswordField, TextField } from '../../components/ui/TextField.jsx';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { safeRedirect } from '../../lib/safe-redirect.js';
import { useAuth } from './AuthProvider.jsx';
import { resendVerification } from './auth-api.js';

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setUnverifiedEmail(null);
    try {
      await signIn(values);
      navigate(safeRedirect(next), { replace: true });
    } catch (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(values.email);
        return;
      }
      applyApiError(error, setError);
    }
  };

  const resend = async () => {
    await resendVerification(unverifiedEmail).catch(() => {});
    setResent(true);
  };

  const keepNext = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <Card as="section" aria-labelledby="login-title">
      <h1 id="login-title" className="text-2xl font-semibold">
        {t('auth.login.title')}
      </h1>
      <p className="mt-1 text-ink-muted">{t('auth.login.subtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {errors.root?.server && <Alert tone="error">{errors.root.server.message}</Alert>}
        {unverifiedEmail && (
          <Alert tone="info">
            <p>{t('auth.login.notVerified')}</p>
            {resent ? (
              <p className="mt-2 font-medium">{t('auth.login.resent')}</p>
            ) : (
              <button
                type="button"
                onClick={resend}
                className="mt-2 font-medium text-accent underline underline-offset-4"
              >
                {t('auth.login.resend')}
              </button>
            )}
          </Alert>
        )}

        <TextField
          label={t('common.email')}
          type="email"
          autoComplete="email"
          error={fieldError(errors.email)}
          {...register('email')}
        />
        <PasswordField
          label={t('common.password')}
          autoComplete="current-password"
          error={fieldError(errors.password)}
          {...register('password')}
        />
        <div className="text-end">
          <Link
            to="/forgot-password"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            {t('auth.login.forgot')}
          </Link>
        </div>
        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting}
          loadingLabel={t('auth.login.submitting')}
        >
          {t('auth.login.submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t('auth.login.noAccount')}{' '}
        <Link
          to={`/register${keepNext}`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          {t('common.signUp')}
        </Link>
      </p>
    </Card>
  );
}
