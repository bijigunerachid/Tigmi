import { EnvelopeOpenIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { buttonClasses } from '../../components/ui/variants.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner.jsx';
import { useLinkToken } from '../../hooks/useLinkToken.js';
import { errorMessage } from '../../lib/i18n.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import {
  acceptInvitation,
  householdKeys,
  previewInvitation,
} from '../households/households-api.js';

const PENDING_INVITATION_KEY = 'tigmi.pendingInvitation';
const NEXT = encodeURIComponent('/invitations/accept');

/**
 * Opened from the invitation email: /invitations/accept#token=…
 * The token is kept in this tab's sessionStorage, so a person without an account can sign up,
 * confirm their email, come back to this tab, sign in and still accept.
 */
export function AcceptInvitationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status, user, signOut } = useAuth();
  const { token, forget } = useLinkToken({ persistKey: PENDING_INVITATION_KEY });

  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => previewInvitation(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  const accept = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: (household) => {
      forget();
      queryClient.invalidateQueries({ queryKey: householdKeys.all });
      navigate(`/households/${household.id}`, { replace: true });
    },
  });

  // A dead link should not be offered again after sign-in.
  const deadLink = preview.error?.code === 'INVALID_OR_EXPIRED_TOKEN';
  useEffect(() => {
    if (deadLink) forget();
  }, [deadLink, forget]);

  const invalid = (message) => (
    <Card as="section" aria-labelledby="invitation-title" className="space-y-4 text-center">
      <ExclamationTriangleIcon aria-hidden="true" className="mx-auto size-12 text-warning" />
      <h1 id="invitation-title" className="text-2xl font-semibold">
        {t('invitations.accept.title')}
      </h1>
      <p role="alert">{message}</p>
      <Link to="/" className={buttonClasses({ fullWidth: true })}>
        {t('notFound.home')}
      </Link>
    </Card>
  );

  if (!token) return invalid(t('invitations.accept.missingToken'));
  if (preview.isPending || status === 'loading') {
    return <LoadingSpinner label={t('invitations.accept.loading')} />;
  }
  if (preview.isError) {
    return invalid(deadLink ? t('invitations.accept.invalid') : errorMessage(preview.error));
  }

  const invitation = preview.data;
  const role = t(`roles.${invitation.role}`).toLowerCase();
  const summary = invitation.invitedBy
    ? t('invitations.accept.summary', {
        inviter: invitation.invitedBy,
        household: invitation.householdName,
        role,
      })
    : t('invitations.accept.summaryNoInviter', { household: invitation.householdName, role });

  return (
    <Card as="section" aria-labelledby="invitation-title" className="space-y-5">
      <div className="text-center">
        <EnvelopeOpenIcon aria-hidden="true" className="mx-auto size-12 text-accent" />
        <h1 id="invitation-title" className="mt-4 text-2xl font-semibold">
          {t('invitations.accept.title')}
        </h1>
      </div>
      <p className="text-lg leading-relaxed">{summary}</p>
      <p className="text-sm text-ink-muted">
        {t('invitations.accept.forEmail', { email: invitation.email })}
      </p>

      {accept.isError && (
        <Alert tone="error">
          {accept.error?.code === 'INVALID_OR_EXPIRED_TOKEN'
            ? t('invitations.accept.invalid')
            : errorMessage(accept.error)}
        </Alert>
      )}

      {status === 'anonymous' && (
        <div className="space-y-3">
          <p>{t('invitations.accept.signInFirst', { email: invitation.email })}</p>
          <Link to={`/login?next=${NEXT}`} className={buttonClasses({ fullWidth: true })}>
            {t('common.signIn')}
          </Link>
          <p className="text-sm text-ink-muted">{t('invitations.accept.noAccount')}</p>
          <Link
            to={`/register?next=${NEXT}`}
            state={{ email: invitation.email }}
            className={buttonClasses({ variant: 'secondary', fullWidth: true })}
          >
            {t('common.signUp')}
          </Link>
        </div>
      )}

      {status === 'authenticated' && user.email !== invitation.email && (
        <div className="space-y-3">
          <Alert tone="error">
            {t('invitations.accept.wrongAccount', {
              current: user.email,
              email: invitation.email,
            })}
          </Alert>
          <Button variant="secondary" className="w-full" onClick={() => signOut()}>
            {t('common.signOut')}
          </Button>
        </div>
      )}

      {status === 'authenticated' && user.email === invitation.email && (
        <Button
          className="w-full"
          onClick={() => accept.mutate()}
          loading={accept.isPending}
          loadingLabel={t('invitations.accept.submitting')}
        >
          {t('invitations.accept.submit')}
        </Button>
      )}
    </Card>
  );
}
