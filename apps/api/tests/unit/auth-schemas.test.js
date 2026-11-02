import { loginSchema, registerSchema } from '@tigmi/validation';

const codes = (result) => result.error.issues.map((issue) => [issue.path.join('.'), issue.message]);

describe('registerSchema (shared with web and mobile)', () => {
  const base = { fullName: 'Amina', email: 'amina@example.com', password: 'twelve chars' };

  it('normalises email and name, defaults language to fr', () => {
    const result = registerSchema.parse({
      ...base,
      fullName: '  Amina  ',
      email: ' AMINA@Example.com ',
    });
    expect(result).toMatchObject({
      fullName: 'Amina',
      email: 'amina@example.com',
      preferredLanguage: 'fr',
    });
  });

  it('accepts Arabic names and Arabic passphrases', () => {
    expect(() =>
      registerSchema.parse({
        ...base,
        fullName: 'أمينة بنعلي',
        password: 'كلمة سر طويلة جدا',
        preferredLanguage: 'ar',
      }),
    ).not.toThrow();
  });

  it('enforces 12–128 characters for passwords', () => {
    expect(codes(registerSchema.safeParse({ ...base, password: 'x'.repeat(11) }))).toEqual([
      ['password', 'password_too_short'],
    ]);
    expect(codes(registerSchema.safeParse({ ...base, password: 'x'.repeat(129) }))).toEqual([
      ['password', 'password_too_long'],
    ]);
  });

  it('rejects unsupported languages', () => {
    expect(codes(registerSchema.safeParse({ ...base, preferredLanguage: 'en' }))).toEqual([
      ['preferredLanguage', 'invalid_language'],
    ]);
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password (old accounts may predate the policy)', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true);
  });

  it('caps password length to bound hashing cost', () => {
    expect(
      loginSchema.safeParse({ email: 'a@example.com', password: 'x'.repeat(129) }).success,
    ).toBe(false);
  });
});
