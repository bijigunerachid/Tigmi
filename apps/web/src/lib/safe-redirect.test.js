import { safeRedirect } from './safe-redirect.js';

describe('safeRedirect', () => {
  it.each(['/', '/households/123', '/invitations/accept?x=1'])('keeps in-app path %s', (path) => {
    expect(safeRedirect(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('rejects %s (open redirect)', (value) => {
    expect(safeRedirect(value, '/safe')).toBe('/safe');
  });
});
