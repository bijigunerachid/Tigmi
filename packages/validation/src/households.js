import { z } from 'zod';

export const HOUSEHOLD_ROLES = ['OWNER', 'ADMIN', 'MEMBER'];

/**
 * Valid ISO 4217 currencies and IANA time zones, taken from the runtime's own Intl data
 * (Node, browsers and Hermes all ship it). Falls back to format-only checks if unavailable.
 */
const supported = (key) => {
  try {
    return new Set(Intl.supportedValuesOf(key));
  } catch {
    return null;
  }
};
const CURRENCIES = supported('currency');
const TIME_ZONES = supported('timeZone');

export const currencySchema = z
  .string({ error: 'required' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, { error: 'invalid_currency' })
  .refine((code) => !CURRENCIES || CURRENCIES.has(code), { error: 'invalid_currency' });

export const timezoneSchema = z
  .string({ error: 'required' })
  .trim()
  .max(64, { error: 'invalid_timezone' })
  .refine((zone) => zone === 'UTC' || !TIME_ZONES || TIME_ZONES.has(zone), {
    error: 'invalid_timezone',
  });

const householdName = z
  .string({ error: 'required' })
  .trim()
  .min(2, { error: 'too_short' })
  .max(100, { error: 'too_long' });

// Empty text clears the description.
const householdDescription = z
  .string()
  .trim()
  .max(500, { error: 'too_long' })
  .transform((value) => value || null)
  .nullable();

export const createHouseholdSchema = z
  .object({
    name: householdName,
    description: householdDescription.optional(),
    currency: currencySchema.default('MAD'),
    timezone: timezoneSchema.default('Africa/Casablanca'),
  })
  .strict();

export const updateHouseholdSchema = z
  .object({
    name: householdName.optional(),
    description: householdDescription.optional(),
    currency: currencySchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { error: 'empty_update' });

/** Deleting a household requires typing its name, like GitHub does for repositories. */
export const deleteHouseholdSchema = z
  .object({ confirmName: z.string({ error: 'required' }).trim().min(1, { error: 'required' }) })
  .strict();

export const updateMemberRoleSchema = z
  .object({ role: z.enum(HOUSEHOLD_ROLES, { error: 'invalid_role' }) })
  .strict();
