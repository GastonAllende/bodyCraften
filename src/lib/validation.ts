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
