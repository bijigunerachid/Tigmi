import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@tigmi/validation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { PasswordField, TextField } from '../../components/ui/TextField.jsx';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { register as registerAccount } from './auth-api.js';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = params.get('next');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    // An invitation page may pass the invited address so the account matches it.
    defaultValues: { fullName: '', email: location.state?.email ?? '', password: '' },
  });

  const onSubmit = async (values) => {
    try {
      await registerAccount(values);
      navigate(`/check-email${next ? `?next=${encodeURIComponent(next)}` : ''}`, {
        state: { email: values.email },
      });
    } catch (error) {
      applyApiError(error, setError);
    }
  };

  return (
    <Card as="section" aria-labelledby="register-title">
      <h1 id="register-title" className="text-2xl font-semibold">
        {t('auth.register.title')}
      </h1>
      <p className="mt-1 text-ink-muted">{t('auth.register.subtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {errors.root?.server && <Alert tone="error">{errors.root.server.message}</Alert>}
        <TextField
          label={t('common.fullName')}
          autoComplete="name"
          error={fieldError(errors.fullName)}
          {...register('fullName')}
        />
        <TextField
          label={t('common.email')}
          type="email"
          autoComplete="email"
          error={fieldError(errors.email)}
          {...register('email')}
        />
        <PasswordField
          label={t('common.password')}
          autoComplete="new-password"
          hint={t('auth.register.passwordHint')}
          error={fieldError(errors.password)}
          {...register('password')}
        />
        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting}
          loadingLabel={t('auth.register.submitting')}
        >
          {t('auth.register.submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t('auth.register.hasAccount')}{' '}
        <Link
          to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          {t('common.signIn')}
        </Link>
      </p>
    </Card>
  );
}
