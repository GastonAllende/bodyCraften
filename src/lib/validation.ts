/**
 * Numeric input rules shared by the plan builder, the workout logger and the
 * server actions behind them. The `sanitize*` helpers run on every keystroke so
 * bad characters never land in state; the `is*` predicates gate submission and
 * are re-checked server-side, since a server action is a public endpoint.
 */

/** Strips everything that is not a digit — no letters, signs or decimal point. */
export function sanitizeInteger(value: string): string {
  return value.replace(/\D/g, "");
}

/** Weight accepts one decimal separator; commas are normalised to a dot. */
export function sanitizeDecimal(value: string): string {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

/** A whole number of 1 or more. Empty and "0" both fail. */
export function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value.trim()) && Number(value.trim()) > 0;
}

/**
 * Prescribed reps are a target, so a plan may say "8" or a range "8-12".
 * Keeps digits and a single separating hyphen; a leading hyphen is dropped.
 */
export function sanitizeRepRange(value: string): string {
  const cleaned = value.replace(/[^\d-]/g, "").replace(/^-+/, "");
  const [low, ...rest] = cleaned.split("-");
  return rest.length > 0 ? `${low}-${rest.join("")}` : low;
}

/** "8" or "8-12". Zero is rejected on either side, as is a descending range. */
export function isValidRepRange(value: string): boolean {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim());
  if (!match) return false;
  const low = Number(match[1]);
  if (low < 1) return false;
  if (match[2] === undefined) return true;
  const high = Number(match[2]);
  return high >= low;
}

/** A decimal value greater than 0 — used for height/weight/circumference inputs. */
export function isPositiveDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim()) && Number(value.trim()) > 0;
}

/** Longest a single profile name field may be, enforced on both sides. */
export const MAX_NAME_LENGTH = 60;

/**
 * Names are free text in many scripts, so this strips only what is never part
 * of one: control characters, and runs of whitespace. It deliberately does not
 * restrict to ASCII letters \u2014 doing so would reject a large share of real
 * names. A single trailing space survives so the user can type "Ana " then
 * "Maria"; `isValidName` and the action both trim before storing.
 */
export function sanitizeName(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, MAX_NAME_LENGTH);
}

/** Empty passes \u2014 every profile name field is optional. */
export function isValidName(value: string): boolean {
  return value.trim().length <= MAX_NAME_LENGTH;
}

/** Nobody in this database was born before this; catches typos like "0202-05-01". */
const MIN_BIRTH_YEAR = 1900;

/**
 * A real calendar date in the past, as `yyyy-MM-dd`. Rejects impossible dates
 * ("2024-02-30", which `new Date` would silently roll forward into March) as
 * well as future ones. Empty passes \u2014 birth date is optional.
 */
export function isValidBirthDate(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const [year, month, day] = trimmed.split("-").map(Number);
  if (year < MIN_BIRTH_YEAR) return false;

  // Parsed as local time, not UTC: `new Date("2024-01-01")` is midnight UTC,
  // which is the previous day west of Greenwich and would shift the date.
  const date = new Date(`${trimmed}T00:00:00`);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}

/** The values the profile's gender field accepts. Unset is stored as NULL. */
export const GENDER_OPTIONS = [
  "female",
  "male",
  "other",
  "prefer_not_to_say",
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];

export function isGender(value: string): value is Gender {
  return (GENDER_OPTIONS as readonly string[]).includes(value);
}
