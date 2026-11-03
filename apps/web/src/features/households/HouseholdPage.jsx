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
import { Card } from '../../components/ui/Card.jsx';
import { SelectField } from '../../components/ui/SelectField.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { TextField } from '../../components/ui/TextField.jsx';
import { applyApiError, fieldError } from '../../lib/forms.js';
import { errorMessage } from '../../lib/i18n.js';
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
      <h2 id="members-title" className="text-lg font-semibold">
        {t('members.title')}
      </h2>
      {query.isPending && <Spinner label={t('common.loading')} />}
      {query.isError && (
        <Alert tone="error" className="mt-4">
          {t('members.loadError')}
        </Alert>
      )}
      {query.isSuccess && (
        <ul className="mt-4 divide-y divide-white/5">
          {query.data.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {member.user.fullName}
                  {member.user.id === user?.id && (
                    <span className="text-ink-muted"> ({t('members.you')})</span>
                  )}
                </span>
                <span className="block truncate text-sm text-ink-muted" title={member.user.email}>
                  {member.user.email}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-sm">
                {t(`roles.${member.role}`)}
              </span>
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
  const [sentTo, setSentTo] = useState(null);
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
    setSentTo(null);
    try {
      const invitation = await createInvitation(household.id, values);
      setSentTo(invitation.email);
      reset({ email: '', role: 'MEMBER' });
      queryClient.invalidateQueries({ queryKey: householdKeys.invitations(household.id) });
    } catch (error) {
      applyApiError(error, setError);
    }
  };

  return (
    <Card as="section" aria-labelledby="invite-title">
      <h2 id="invite-title" className="text-lg font-semibold">
        {t('invitations.title')}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        {errors.root?.server && <Alert tone="error">{errors.root.server.message}</Alert>}
        {sentTo && <Alert tone="success">{t('invitations.sent', { email: sentTo })}</Alert>}
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
  const revoke = useMutation({
    mutationFn: (invitationId) => revokeInvitation(household.id, invitationId),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: householdKeys.invitations(household.id) }),
  });
  const formatDate = (iso) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeZone: household.timezone,
    }).format(new Date(iso));

  return (
    <Card as="section" aria-labelledby="pending-title">
      <h2 id="pending-title" className="text-lg font-semibold">
        {t('invitations.pendingTitle')}
      </h2>
      {revoke.isError && (
        <Alert tone="error" className="mt-4">
          {errorMessage(revoke.error)}
        </Alert>
      )}
      {query.isPending && <Spinner label={t('common.loading')} />}
      {query.isError && (
        <Alert tone="error" className="mt-4">
          {errorMessage(query.error)}
        </Alert>
      )}
      {query.isSuccess && query.data.length === 0 && (
        <p className="mt-4 text-ink-muted">{t('invitations.pendingEmpty')}</p>
      )}
      {query.isSuccess && query.data.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5">
          {query.data.map((invitation) => {
            const canRevoke = household.myRole === 'OWNER' || invitation.role === 'MEMBER';
            return (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium" title={invitation.email}>
                    {invitation.email}
                  </span>
                  <span className="block text-sm text-ink-muted">
                    {t(`roles.${invitation.role}`)} · {t(`invitations.status.${invitation.status}`)}{' '}
                    · {t('invitations.expires', { date: formatDate(invitation.expiresAt) })}
                  </span>
                </span>
                {canRevoke && (
                  <Button
                    variant="danger"
                    onClick={() => revoke.mutate(invitation.id)}
                    loading={revoke.isPending && revoke.variables === invitation.id}
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

  if (query.isPending) return <Spinner label={t('common.loading')} />;
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
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          {t('households.back')}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{household.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t(`roles.${household.myRole}`)} ·{' '}
          {t('households.settings', { currency: household.currency, timezone: household.timezone })}
        </p>
      </div>
      <MembersList householdId={household.id} />
      {canInvite && <InviteForm household={household} />}
      {canInvite && <PendingInvitations household={household} />}
    </div>
  );
}
