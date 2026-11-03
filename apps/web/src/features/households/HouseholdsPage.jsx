import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createHouseholdSchema } from '@tigmi/validation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Modal } from '../../components/ui/Dialog.jsx';
import { IsoHouse } from '../../components/illustrations/IsoHouse.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { TextField } from '../../components/ui/TextField.jsx';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { createHousehold, householdKeys, listHouseholds } from './households-api.js';
import { ROLE_TONES } from './roles.js';

// Only the name is asked here; currency and time zone keep their defaults (MAD, Casablanca).
const formSchema = createHouseholdSchema.pick({ name: true });

function CreateHouseholdForm({ autoFocus = false }) {
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
      navigate(`/households/${household.id}`, { viewTransition: true });
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {errors.root?.server && <Alert tone="error">{errors.root.server.message}</Alert>}
      <TextField
        label={t('households.create.name')}
        placeholder={t('households.create.namePlaceholder')}
        error={fieldError(errors.name)}
        data-autofocus={autoFocus || undefined}
        {...register('name')}
      />
      <Button type="submit" loading={isSubmitting} loadingLabel={t('households.create.submitting')}>
        {t('households.create.submit')}
      </Button>
    </form>
  );
}

function HouseholdCard({ household }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to={`/households/${household.id}`}
        viewTransition
        className="rim group flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface/80 p-5 shadow-[var(--shadow-card)] transition-[border-color,background-color,transform] duration-200 ease-[var(--ease-out)] hover:border-accent/35 hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.99]"
      >
        <Avatar name={household.name} seed={household.id} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold tracking-tight">
            {household.name}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Badge tone={ROLE_TONES[household.myRole]}>{t(`roles.${household.myRole}`)}</Badge>
            <span>{t('households.members', { count: household.memberCount })}</span>
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-subtle transition-colors group-hover:text-accent rtl:-scale-x-100"
        />
        <span className="sr-only">{t('households.open')}</span>
      </Link>
    </li>
  );
}

export function HouseholdsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: householdKeys.all, queryFn: listHouseholds });
  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const hasHouseholds = query.isSuccess && query.data.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {firstName && (
            <p className="text-sm font-medium text-accent">
              {t('households.greeting', { name: firstName })}
            </p>
          )}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('households.title')}
          </h1>
          <p className="mt-2 max-w-xl text-ink-muted">{t('households.subtitle')}</p>
        </div>
        {hasHouseholds && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden="true" className="size-5" />
            {t('households.newHousehold')}
          </Button>
        )}
      </header>

      {query.isPending && (
        <div aria-busy="true" className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <span className="sr-only" role="status">
            {t('common.loading')}
          </span>
          {[0, 1].map((key) => (
            <div
              key={key}
              className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line p-5"
            >
              <Skeleton className="size-14 rounded-2xl" />
              <span className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </span>
            </div>
          ))}
        </div>
      )}

      {query.isError && (
        <Alert tone="error">
          {t('households.loadError')}{' '}
          <button type="button" onClick={() => query.refetch()} className="font-medium underline">
            {t('common.retry')}
          </button>
        </Alert>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <Card className="animate-rise-in">
          <EmptyState
            illustration={<IsoHouse className="h-40 w-auto" />}
            title={t('households.emptyTitle')}
            description={t('households.empty')}
          />
          <div className="mx-auto max-w-md">
            <CreateHouseholdForm />
          </div>
        </Card>
      )}

      {hasHouseholds && (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          {query.data.map((household) => (
            <HouseholdCard key={household.id} household={household} />
          ))}
        </ul>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t('households.create.title')}
        size="sm"
      >
        <CreateHouseholdForm autoFocus />
      </Modal>
    </div>
  );
}
