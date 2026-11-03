import pino from 'pino';
import { createMailService, createSmtpTransport } from '../../src/modules/mail/mail.service.js';
import { createTestEnv } from '../helpers/test-env.js';

/**
 * Real SMTP delivery through Mailpit (docker compose / CI service), checked via Mailpit's API.
 * Proves the nodemailer transport, encoding of Arabic text and the From header end to end.
 */
const MAILPIT_API = process.env.MAILPIT_API_URL ?? 'http://localhost:8025/api/v1';

/** Mailpit indexes asynchronously; poll briefly instead of assuming instant visibility. */
async function findMessages(query, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(query)}`);
    expect(res.ok).toBe(true);
    const { messages } = await res.json();
    if (messages.length > 0) return messages;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return [];
}

describe('SMTP delivery (Mailpit)', () => {
  const env = createTestEnv();
  const transport = createSmtpTransport(env);
  const mail = createMailService({
    transport,
    from: env.MAIL_FROM,
    appUrl: env.APP_URL,
    logger: pino({ level: 'silent' }),
  });

  afterAll(() => transport.close());

  it('delivers an Arabic verification email that Mailpit receives intact', async () => {
    const to = `smtp-test-${Date.now()}@example.com`;
    mail.sendVerificationEmail(
      { email: to, fullName: 'أمينة', preferredLanguage: 'ar' },
      'A'.repeat(43),
    );
    await mail.flush();

    const messages = await findMessages(`to:${to}`);
    expect(messages).toHaveLength(1);
    expect(messages[0].Subject).toBe('تأكيد بريدك الإلكتروني — Tigmi');
    expect(messages[0].From.Address).toBe('no-reply@tigmi.local');

    const full = await (await fetch(`${MAILPIT_API}/message/${messages[0].ID}`)).json();
    expect(full.Text).toContain('/verify-email#token=' + 'A'.repeat(43));
    expect(full.HTML).toContain('dir="rtl"');
  }, 20_000);
});
