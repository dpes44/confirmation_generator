export type Grouping = 'none' | 'western' | 'nepali';

/**
 * Formats an amount for the letter. The reference letter prints bare digits with
 * no separators, which is the default; `western` gives 1,264,500 and `nepali`
 * gives lakh/crore grouping (12,64,500).
 */
export function formatAmount(value: number | string | null | undefined, grouping: Grouping = 'none'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '0';

  const negative = n < 0;
  const abs = Math.abs(n);
  // Trim pointless trailing zeros: 989702.50 -> "989702.5", 45000.00 -> "45000".
  const fixed = abs.toFixed(2).replace(/\.?0+$/, '');
  const [intPart, decPart] = fixed.split('.');

  let grouped = intPart;
  if (grouping === 'western') {
    grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } else if (grouping === 'nepali') {
    // Last three digits, then pairs.
    const head = intPart.slice(0, -3);
    const tail = intPart.slice(-3);
    grouped = head ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail : tail;
  }

  const out = decPart ? `${grouped}.${decPart}` : grouped;
  return negative ? `(${out})` : out;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** "2025-07-18" -> "July 18, 2025", matching the reference letter. */
export function formatLetterDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const iso = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(value);
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** Today in the machine's local timezone as YYYY-MM-DD (avoids UTC off-by-one). */
export function todayIso(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fills {{placeholders}} in the configurable template strings. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return (tpl ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}
