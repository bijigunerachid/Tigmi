import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInvitationSchema } from '@tigmi/validation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { SelectField } from '../../components/ui/SelectField.jsx';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner.jsx';
import { TextField } from '../../components/ui/TextField.jsx';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { errorMessage, intlLocale } from '../../lib/i18n.js';
import { ROLE_TONES } from './roles.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import {
  createInvitation,
  getHousehold,
  householdKeys,
  listInvitations,
  listMembers,
  revokeInvitation,
} from './households-api.js';

function MembersList({ householdId }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: householdKeys.members(householdId),
    queryFn: () => listMembers(householdId),
  });

  return (
    <Card as="section" aria-labelledby="members-title">
      <CardHeader title={t('members.title')} titleId="members-title" />
      {query.isPending && <LoadingSpinner label={t('common.loading')} />}
      {query.isError && (
        <Alert tone="error" className="mt-4">
          {t('members.loadError')}
        </Alert>
      )}
      {query.isSuccess && (
        <ul className="divide-y divide-line">
          {query.data.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              <Avatar name={member.user.fullName} seed={member.user.id} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {member.user.fullName}
                  {member.user.id === user?.id && (
                    <span className="text-ink-muted"> ({t('members.you')})</span>
                  )}
                </span>
                <span className="block truncate text-sm text-ink-muted" title={member.user.email}>
                  <bdi>{member.user.email}</bdi>
                </span>
              </span>
              <Badge tone={ROLE_TONES[member.role]}>{t(`roles.${member.role}`)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function InviteForm({ household }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });

  // Owners may invite admins; admins may only invite members (enforced by the API too).
  const roleOptions = (household.myRole === 'OWNER' ? ['MEMBER', 'ADMIN'] : ['MEMBER']).map(
    (role) => ({ value: role, label: t(`roles.${role}`) }),
  );

  const onSubmit = async (values) => {
    try {
      const invitation = await createInvitation(household.id, values);
      toast.success(t('invitations.sent', { email: invitation.email }));
      reset({ email: '', role: 'MEMBER' });
      queryClient.invalidateQueries({ queryKey: householdKeys.invitations(household.id) });
    } catch (error) {
      applyApiError(error, setError);
    }
  };

  return (
    <Card as="section" aria-labelledby="invite-title">
      <CardHeader title={t('invitations.title')} titleId="invite-title" />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root?.server && <Alert tone="error">{errors.root.server.message}</Alert>}
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <TextField
            label={t('invitations.email')}
            type="email"
            autoComplete="off"
            error={fieldError(errors.email)}
            {...register('email')}
          />
          <SelectField
            label={t('invitations.role')}
            options={roleOptions}
            error={fieldError(errors.role)}
            {...register('role')}
          />
        </div>
        <Button type="submit" loading={isSubmitting} loadingLabel={t('invitations.submitting')}>
          {t('invitations.submit')}
        </Button>
      </form>
    </Card>
  );
}

function PendingInvitations({ household }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: householdKeys.invitations(household.id),
    queryFn: () => listInvitations(household.id),
  });
  const toast = useToast();
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const revoke = useMutation({
    mutationFn: (invitationId) => revokeInvitation(household.id, invitationId),
    onSuccess: () => {
      setPendingRevoke(null);
      toast.success(t('invitations.revoked'));
    },
    // Close the dialog so the error shown in the card is visible (the page behind is inert).
    onError: () => setPendingRevoke(null),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: householdKeys.invitations(household.id) }),
  });
  const formatDate = (iso) =>
    new Intl.DateTimeFormat(intlLocale(i18n.language), {
      dateStyle: 'medium',
      timeZone: household.timezone,
    }).format(new Date(iso));

  return (
    <Card as="section" aria-labelledby="pending-title">
      <CardHeader title={t('invitations.pendingTitle')} titleId="pending-title" />
      {revoke.isError && (
        <Alert tone="error" className="mt-4">
          {errorMessage(revoke.error)}
        </Alert>
      )}
      {query.isPending && <LoadingSpinner label={t('common.loading')} />}
      {query.isError && (
        <Alert tone="error" className="mt-4">
          {errorMessage(query.error)}
        </Alert>
      )}
      {query.isSuccess && query.data.length === 0 && (
        <p className="mt-4 text-ink-muted">{t('invitations.pendingEmpty')}</p>
      )}
      {query.isSuccess && query.data.length > 0 && (
        <ul className="divide-y divide-line">
          {query.data.map((invitation) => {
            const canRevoke = household.myRole === 'OWNER' || invitation.role === 'MEMBER';
            return (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium" title={invitation.email}>
                    <bdi>{invitation.email}</bdi>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    <Badge tone={ROLE_TONES[invitation.role]}>
                      {t(`roles.${invitation.role}`)}
                    </Badge>
                    <Badge tone={invitation.status === 'expired' ? 'warning' : 'neutral'}>
                      {t(`invitations.status.${invitation.status}`)}
                    </Badge>
                    <span>
                      {t('invitations.expires', { date: formatDate(invitation.expiresAt) })}
                    </span>
                  </span>
                </span>
                {canRevoke && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      revoke.reset();
                      setPendingRevoke(invitation);
                    }}
                    aria-label={t('invitations.revokeLabel', { email: invitation.email })}
                  >
                    {t('invitations.revoke')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        onConfirm={() => revoke.mutate(pendingRevoke.id)}
        loading={revoke.isPending}
        title={t('invitations.revokeConfirmTitle')}
        message={t('invitations.revokeConfirmMessage', { email: pendingRevoke?.email })}
        confirmLabel={t('invitations.revoke')}
        cancelLabel={t('common.back')}
      />
    </Card>
  );
}

export function HouseholdPage() {
  const { t } = useTranslation();
  const { householdId } = useParams();
  const query = useQuery({
    queryKey: householdKeys.detail(householdId),
    queryFn: () => getHousehold(householdId),
    retry: (count, error) => error?.status >= 500 && count < 2,
  });

  if (query.isPending) {
    return (
      <div aria-busy="true" className="space-y-6">
        <span className="sr-only" role="status">
          {t('common.loading')}
        </span>
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <span className="flex-1 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </span>
        </div>
        <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{errorMessage(query.error)}</Alert>
        <Link to="/" className="font-medium text-accent">
          {t('households.back')}
        </Link>
      </div>
    );
  }

  const household = query.data;
  const canInvite = household.permissions.includes('members:invite');

  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/"
          viewTransition
          className="inline-flex min-h-9 items-center gap-2 rounded-lg text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          {t('households.back')}
        </Link>
        <div className="mt-4 flex items-center gap-4 sm:gap-5">
          <Avatar
            name={household.name}
            seed={household.id}
            size="lg"
            className="sm:size-16 sm:text-xl"
          />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">
              {household.name}
            </h1>
            <dl className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <div className="contents">
                <dt className="sr-only">{t('households.yourRole')}</dt>
                <dd>
                  <Badge tone={ROLE_TONES[household.myRole]}>
                    {t(`roles.${household.myRole}`)}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-0.5 ring-1 ring-line">
                <dt className="text-ink-subtle">{t('households.currency')}</dt>
                <dd className="font-medium" dir="ltr">
                  {household.currency}
                </dd>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-0.5 ring-1 ring-line">
                <dt className="text-ink-subtle">{t('households.timezone')}</dt>
                <dd className="font-medium" dir="ltr">
                  {household.timezone}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div
        className={
          canInvite
            ? 'grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'
            : ''
        }
      >
        <MembersList householdId={household.id} />
        {canInvite && (
          <div className="space-y-6">
            <InviteForm household={household} />
            <PendingInvitations household={household} />
          </div>
        )}
      </div>
    </div>
  );
}
