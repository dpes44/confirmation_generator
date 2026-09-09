/**
 * Nepali fiscal-year helpers.
 *
 * Deliberately NO Bikram Sambat <-> Gregorian conversion here. Ashadh (month 03)
 * has either 31 or 32 days depending on the year, and getting that table wrong
 * would silently print a wrong balance date on an audit document. Instead the BS
 * dates are stored and printed as literal text, seeded with a sensible default
 * that the user can correct once per batch. The app then remembers whatever was
 * used for that fiscal year and reuses it next time (see `api/letters/defaults`).
 */

export type FiscalYear = { start: number; end: number; label: string };

/** Accepts "2081/82", "2081-82", "2081/2082", "208182" and normalises to "2081/82". */
export function parseFiscalYear(input: string): FiscalYear | null {
  const s = (input ?? '').trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})\s*[\/\-–]?\s*(\d{2}|\d{4})$/);
  if (!m) return null;

  const start = Number(m[1]);
  const rawEnd = m[2];
  const end = rawEnd.length === 4 ? Number(rawEnd) : Math.floor(start / 100) * 100 + Number(rawEnd);

  // A fiscal year always spans exactly two consecutive BS years.
  if (end !== start + 1) return null;
  if (start < 2000 || start > 2200) return null;

  return { start, end, label: `${start}/${String(end).slice(-2)}` };
}

/** Nepali FY runs Shrawan 1 of the start year to the last day of Ashadh of the end year. */
export function defaultOpeningDate(fy: FiscalYear): string {
  return `${fy.start}/04/01`;
}

/**
 * Last day of Ashadh. 32 matches the reference letter for 2081/82; it is a
 * starting point, not a truth claim, and the field stays editable.
 */
export function defaultClosingDate(fy: FiscalYear): string {
  return `${fy.end}/03/32`;
}

/** Shape check only, so a typo like "2082/3/32" or "2082/13/01" is caught. */
export function isBsDateShape(v: string): boolean {
  const m = (v ?? '').trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 32;
}
