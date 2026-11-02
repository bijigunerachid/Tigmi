import pino from 'pino';
import { createMailService, createSmtpTransport } from '../../src/modules/mail/mail.service.js';
import { createTestEnv } from '../helpers/test-env.js';

/**
 * Real SMTP delivery through Mailpit (docker compose / CI service), checked via Mailpit's API.
 * Proves the nodemailer transport, encoding of Arabic text and the From header end to end.
 */
const MAILPIT_API = process.env.MAILPIT_API_URL ?? 'http://localhost:8025/api/v1';

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

    const search = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    expect(search.ok).toBe(true);
    const { messages } = await search.json();
    expect(messages).toHaveLength(1);
    expect(messages[0].Subject).toBe('تأكيد بريدك الإلكتروني — Tigmi');
    expect(messages[0].From.Address).toBe('no-reply@tigmi.local');

    const full = await (await fetch(`${MAILPIT_API}/message/${messages[0].ID}`)).json();
    expect(full.Text).toContain('/verify-email#token=' + 'A'.repeat(43));
    expect(full.HTML).toContain('dir="rtl"');
  });
});
