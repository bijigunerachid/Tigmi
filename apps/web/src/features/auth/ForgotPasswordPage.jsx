import { zodResolver } from '@hookform/resolvers/zod';
import { emailRequestSchema } from '@tigmi/validation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { TextField } from '../../components/ui/TextField.jsx';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { forgotPassword } from './auth-api.js';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(emailRequestSchema), defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (error) {
      applyApiError(error, setError);
    }
  };

  return (
    <Card as="section" aria-labelledby="forgot-title">
      <h1 id="forgot-title" className="text-2xl font-semibold">
        {t('auth.forgot.title')}
      </h1>
      <p className="mt-1 text-ink-muted">{t('auth.forgot.subtitle')}</p>

      {sent ? (
        <Alert tone="success" className="mt-6">
          {t('auth.forgot.sent')}
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
          {errors.root?.server && <Alert tone="error">{errors.root.server.message}</Alert>}
          <TextField
            label={t('common.email')}
            type="email"
            autoComplete="email"
            error={fieldError(errors.email)}
            {...register('email')}
          />
          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            loadingLabel={t('auth.forgot.submitting')}
          >
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          {t('common.back')}
        </Link>
      </p>
    </Card>
  );
}
