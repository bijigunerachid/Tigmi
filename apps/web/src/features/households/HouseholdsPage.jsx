import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRightIcon, HomeModernIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createHouseholdSchema } from '@tigmi/validation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { TextField } from '../../components/ui/TextField.jsx';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { createHousehold, householdKeys, listHouseholds } from './households-api.js';

// Only the name is asked here; currency and time zone keep their defaults (MAD, Casablanca).
const formSchema = createHouseholdSchema.pick({ name: true });

function CreateHouseholdForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(formSchema), defaultValues: { name: '' } });

  const mutation = useMutation({
    mutationFn: createHousehold,
    onSuccess: (household) => {
      queryClient.invalidateQueries({ queryKey: householdKeys.all });
      navigate(`/households/${household.id}`);
    },
  });

  const onSubmit = async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      applyApiError(error, setError);
    }
  };

  return (
    <Card as="section" aria-labelledby="create-household-title">
      <h2 id="create-household-title" className="text-lg font-semibold">
        {t('households.create.title')}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        {errors.root?.server && <Alert tone="error">{errors.root.server.message}</Alert>}
        <TextField
          label={t('households.create.name')}
          placeholder={t('households.create.namePlaceholder')}
          error={fieldError(errors.name)}
          {...register('name')}
        />
        <Button
          type="submit"
          loading={isSubmitting}
          loadingLabel={t('households.create.submitting')}
        >
          {t('households.create.submit')}
        </Button>
      </form>
    </Card>
  );
}

export function HouseholdsPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: householdKeys.all, queryFn: listHouseholds });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('households.title')}</h1>

      {query.isPending && <Spinner label={t('common.loading')} />}

      {query.isError && (
        <Alert tone="error">
          {t('households.loadError')}{' '}
          <button type="button" onClick={() => query.refetch()} className="font-medium underline">
            {t('common.retry')}
          </button>
        </Alert>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <Card className="text-center">
          <HomeModernIcon aria-hidden="true" className="mx-auto size-12 text-accent" />
          <p className="mx-auto mt-3 max-w-md text-ink-muted">{t('households.empty')}</p>
        </Card>
      )}

      {query.isSuccess && query.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {query.data.map((household) => (
            <li key={household.id}>
              <Link
                to={`/households/${household.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-surface p-5 transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{household.name}</span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {t(`roles.${household.myRole}`)} ·{' '}
                    {t('households.members', { count: household.memberCount })}
                  </span>
                </span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-ink-muted rtl:-scale-x-100"
                />
                <span className="sr-only">{t('households.open')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateHouseholdForm />
    </div>
  );
}
