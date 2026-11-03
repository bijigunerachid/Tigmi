import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@tigmi/validation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { PasswordField } from '../../components/ui/TextField.jsx';
import { useLinkToken } from '../../hooks/useLinkToken.js';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { resetPassword } from './auth-api.js';

// Same rules as the API, minus the token (which comes from the link, not the form).
const formSchema = resetPasswordSchema.pick({ password: true });

/** Opened from the reset email: /reset-password#token=… */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = useLinkToken();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(formSchema), defaultValues: { password: '' } });

  const onSubmit = async ({ password }) => {
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (error) {
      applyApiError(error, setError);
    }
  };

  return (
    <Card as="section" aria-labelledby="reset-title">
      <h1 id="reset-title" className="text-2xl font-semibold">
        {t('auth.reset.title')}
      </h1>

      {!token && (
        <div className="mt-6 space-y-4">
          <Alert tone="error">{t('auth.reset.missingToken')}</Alert>
          <Link to="/forgot-password" className="block text-center font-medium text-accent">
            {t('auth.verify.requestNew')}
          </Link>
        </div>
      )}

      {token && done && (
        <div className="mt-6 space-y-4">
          <Alert tone="success">{t('auth.reset.success')}</Alert>
          <Link
            to="/login"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white hover:bg-brand/90"
          >
            {t('common.signIn')}
          </Link>
        </div>
      )}

      {token && !done && (
        <>
          <p className="mt-1 text-ink-muted">{t('auth.reset.subtitle')}</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
            {errors.root?.server && (
              <Alert tone="error">
                {errors.root.server.message}{' '}
                <Link to="/forgot-password" className="font-medium text-accent underline">
                  {t('auth.verify.requestNew')}
                </Link>
              </Alert>
            )}
            <PasswordField
              label={t('auth.reset.newPassword')}
              autoComplete="new-password"
              hint={t('auth.register.passwordHint')}
              error={fieldError(errors.password)}
              {...register('password')}
            />
            <Button
              type="submit"
              className="w-full"
              loading={isSubmitting}
              loadingLabel={t('auth.reset.submitting')}
            >
              {t('auth.reset.submit')}
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}
