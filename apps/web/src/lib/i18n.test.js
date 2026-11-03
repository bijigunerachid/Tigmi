import ar from '../locales/ar/translation.json';
import fr from '../locales/fr/translation.json';
import i18n, { intlLocale, setLanguage } from './i18n.js';

/** Flattens {a: {b: 'x'}} into ['a.b']; plural suffixes are compared without the suffix. */
function keys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}
const base = (key) => key.replace(/_(zero|one|two|few|many|other)$/, '');
const placeholders = (text) =>
  [...String(text).matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
const lookup = (object, path) => path.split('.').reduce((node, part) => node?.[part], object);

describe('translations', () => {
  it('has an Arabic translation for every French string (and nothing extra)', () => {
    const frKeys = new Set(keys(fr).map(base));
    const arKeys = new Set(keys(ar).map(base));
    expect([...frKeys].filter((k) => !arKeys.has(k))).toEqual([]);
    expect([...arKeys].filter((k) => !frKeys.has(k))).toEqual([]);
  });

  it('keeps the same {{placeholders}} in both languages', () => {
    // Arabic singular/dual forms say "one member" / "two members" without the digit, so plural
    // forms may drop {{count}} — every other placeholder must match exactly.
    const withoutCount = (key, list) =>
      key !== base(key) ? list.filter((p) => p !== 'count') : list;
    const mismatches = keys(fr)
      .filter((key) => lookup(ar, key) !== undefined)
      .filter(
        (key) =>
          withoutCount(key, placeholders(lookup(fr, key))).join() !==
          withoutCount(key, placeholders(lookup(ar, key))).join(),
      );
    expect(mismatches).toEqual([]);
  });

  it('uses Arabic plural forms', async () => {
    await i18n.changeLanguage('ar');
    expect(i18n.t('households.members', { count: 1 })).toBe('عضو واحد');
    expect(i18n.t('households.members', { count: 2 })).toBe('عضوان');
    expect(i18n.t('households.members', { count: 5 })).toBe('5 أعضاء');
    await i18n.changeLanguage('fr');
    expect(i18n.t('households.members', { count: 5 })).toBe('5 membres');
  });
});

describe('language switching', () => {
  afterEach(() => i18n.changeLanguage('fr'));

  it('remembers the choice and switches direction', () => {
    setLanguage('ar');
    expect(window.localStorage.getItem('tigmi.language')).toBe('ar');
    expect(i18n.dir()).toBe('rtl');
    expect(intlLocale()).toBe('ar-MA');
  });

  it('ignores unsupported languages', () => {
    setLanguage('en');
    expect(i18n.language).toBe('fr');
  });
});
