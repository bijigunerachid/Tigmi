/**
 * Returns `next` only if it is a path inside this app; otherwise the fallback.
 * Blocks open redirects such as `?next=https://evil.example` or `?next=//evil.example`.
 */
export function safeRedirect(next, fallback = '/') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('\\')) return fallback; // some browsers treat "/\evil" like "//evil"
  return next;
}
