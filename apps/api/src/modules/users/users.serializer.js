/**
 * The only shape of a user that may leave the API. Explicit allow-list: new database
 * columns (password hash, lockout counters, …) are never exposed by accident.
 */
export function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    preferredLanguage: user.preferredLanguage,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
