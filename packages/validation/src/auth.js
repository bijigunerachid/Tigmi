import { z } from 'zod';

export const LANGUAGES = ['fr', 'ar'];
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Emails are compared case-insensitively: always trimmed and lower-cased before use. */
export const emailSchema = z
  .string({ error: 'required' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'too_long' })
  .pipe(z.email({ error: 'invalid_email' }));

/**
 * Length-based policy (NIST SP 800-63B / OWASP ASVS): no forced character classes,
 * spaces and any Unicode allowed so passphrases work in French and Arabic.
 */
export const passwordSchema = z
  .string({ error: 'required' })
  .min(PASSWORD_MIN_LENGTH, { error: 'password_too_short' })
  .max(PASSWORD_MAX_LENGTH, { error: 'password_too_long' });

/** Rejects control characters (newlines, tabs, NUL…): names end up in emails and headers. */
export const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;

export const fullNameSchema = z
  .string({ error: 'required' })
  .trim()
  .min(2, { error: 'too_short' })
  .max(100, { error: 'too_long' })
  .regex(NO_CONTROL_CHARS, { error: 'invalid_characters' });

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    preferredLanguage: z.enum(LANGUAGES, { error: 'invalid_language' }).default('fr'),
  })
  .strict()
  .refine((data) => data.password.toLowerCase() !== data.email, {
    path: ['password'],
    error: 'password_equals_email',
  });

export const loginSchema = z
  .object({
    email: emailSchema,
    // No length rules on login: the stored hash decides. Only cap size to bound hashing cost.
    password: z
      .string({ error: 'required' })
      .min(1, { error: 'required' })
      .max(PASSWORD_MAX_LENGTH),
  })
  .strict();

/** Mobile clients send the refresh token in the body; web clients use the HttpOnly cookie. */
export const refreshBodySchema = z
  .object({ refreshToken: z.string().min(20).max(200).optional() })
  .strict();

/** Tokens from email links: 32 random bytes, base64url (43 chars). */
export const emailTokenSchema = z
  .string({ error: 'required' })
  .regex(/^[\w-]{43}$/, { error: 'invalid_token' });

export const verifyEmailSchema = z.object({ token: emailTokenSchema }).strict();

/** Body of "resend verification" and "forgot password". */
export const emailRequestSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({ token: emailTokenSchema, password: passwordSchema })
  .strict();
