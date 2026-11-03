import nodemailer from 'nodemailer';
import { renderEmail } from './templates.js';

/** SMTP transport from validated env (Mailpit locally, a real provider in production). */
export function createSmtpTransport(env) {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }),
    // Never send credentials over plain text in production.
    requireTLS: env.NODE_ENV === 'production' && !env.SMTP_SECURE,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/**
 * Sends transactional emails without making the HTTP request wait for SMTP:
 *  - responses stay fast and identical in timing whether or not an email is sent
 *    (no account enumeration by timing);
 *  - an SMTP outage never fails registration or password reset — it is logged.
 * Phase 7 moves delivery to a durable job queue with retries.
 *
 * `flush()` waits for in-flight emails (used by tests and graceful shutdown).
 */
export function createMailService({ transport, from, appUrl, logger }) {
  const pending = new Set();

  function deliver(to, template, { language, name, actionUrl, vars }) {
    const message = renderEmail(template, { language, name, actionUrl, vars });
    const promise = transport
      .sendMail({ from, to, subject: message.subject, text: message.text, html: message.html })
      .catch((err) => logger.error({ err, template }, 'Email delivery failed'))
      .finally(() => pending.delete(promise));
    pending.add(promise);
  }

  const forUser = (user) => ({ language: user.preferredLanguage, name: user.fullName });

  return {
    sendVerificationEmail(user, token) {
      deliver(user.email, 'verifyEmail', {
        ...forUser(user),
        actionUrl: `${appUrl}/verify-email#token=${token}`,
      });
    },
    sendAccountExistsEmail(user) {
      deliver(user.email, 'accountExists', {
        ...forUser(user),
        actionUrl: `${appUrl}/forgot-password`,
      });
    },
    sendPasswordResetEmail(user, token) {
      deliver(user.email, 'passwordReset', {
        ...forUser(user),
        actionUrl: `${appUrl}/reset-password#token=${token}`,
      });
    },
    sendPasswordChangedEmail(user) {
      deliver(user.email, 'passwordChanged', {
        ...forUser(user),
        actionUrl: `${appUrl}/forgot-password`,
      });
    },
    /** `recipient` may have no account yet: then no name, and the inviter's language is used. */
    sendInvitationEmail({ to, language, name, inviterName, householdName, role, token }) {
      deliver(to, 'invitation', {
        language,
        name,
        actionUrl: `${appUrl}/invitations/accept#token=${token}`,
        vars: { inviterName, householdName, role },
      });
    },
    async flush() {
      await Promise.allSettled([...pending]);
    },
  };
}
