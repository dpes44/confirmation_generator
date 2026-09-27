import { AMOUNT_FIELDS, type AmountField } from './types';
import type { Grid } from './spreadsheet';

/** Every field an imported column can be mapped to. */
export type TargetField = AmountField | 'name' | 'address' | 'pan_number' | 'phone' | 'ignore';

export const TARGET_LABELS: Record<TargetField, string> = {
  name: 'Client name',
  address: 'Address',
  pan_number: 'PAN number',
  phone: 'Phone',
  opening_balance: 'Opening balance',
  sales: 'Sales',
  purchases: 'Purchases',
  sales_return: 'Sales return',
  purchases_return: 'Purchases return',
  purchase_annex13: 'Purchase Annex 13',
  sales_annex13: 'Sales Annex 13',
  annex13: 'Annex 13 (combined)',
  closing_balance: 'Closing balance',
  ignore: '— ignore —',
};

/**
 * Header synonyms, matched against the header text reduced to lowercase letters
 * and digits. Order matters: the first entry whose pattern matches wins, so more
 * specific patterns (sales return) must precede looser ones (sales).
 */
// Word fragments shared by the rules below. Headers are normalised to bare
// lowercase alphanumerics first, so there is no whitespace to match.
//   PURCHASE tolerates the common "Purchse" misspelling (missing 'a').
//   ANNEX    tolerates "Anex" and "Annexure", with or without the 13.
//   QUALIFIER absorbs the Net/Total/Gross prefix accountants add.
const PURCHASE = 'purcha?ses?';
const SALE = 'sales?';
const ANNEX = 'ann?ex(ure)?1?3?';
const QUALIFIER = '(net|total|gross)?';
const SUFFIX = '(amount|value|amt)?';

const HEADER_RULES: Array<[TargetField, RegExp]> = [
  ['pan_number', /^(pan|panno|pannumber|vat|vatno|panvat|panvatno)$/],
  ['phone', /^(phone|phoneno|phonenumber|mobile|contact|contactno)$/],
  ['address', /^(address|addr|location|place)$/],
  ['name', new RegExp(
    '^((company|client|customer|party|firm|vendor|supplier|partys?)(s?name)?|name)$')],
  ['sales_return', new RegExp(`${SALE}return|return${SALE}|${SALE}rtn`)],
  ['purchases_return', new RegExp(`${PURCHASE}return|return${PURCHASE}|${PURCHASE}rtn`)],
  ['opening_balance', /openingbalance|opening|openbal|obalance|^ob$/],
  ['closing_balance', /closingbalance|closing|closebal|cbalance|^cb$/],
  // The two split Annex columns must be tried before the generic annex rule,
  // which would otherwise swallow both.
  ['purchase_annex13', new RegExp(`${PURCHASE}${ANNEX}|${ANNEX}${PURCHASE}`)],
  ['sales_annex13', new RegExp(`${SALE}${ANNEX}|${ANNEX}${SALE}`)],
  ['annex13', /annex13|annexure13|anx13|anex13|annex|anex/],
  ['purchases', new RegExp(`^${QUALIFIER}${PURCHASE}${SUFFIX}$`)],
  ['sales', new RegExp(`^${QUALIFIER}${SALE}${SUFFIX}$|^turnover$`)],
];

function normalise(header: string): string {
  return (header ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * True for the filler headers Excel writes when a table is declared wider than
 * its data ("Column12", "Unnamed: 4"), and for row-number columns. These carry
 * no meaning and must not make a column look populated.
 */
export function isPlaceholderHeader(header: string): boolean {
  const key = normalise(header);
  if (!key) return true;
  return /^column\d+$/.test(key) || /^unnamed\d*$/.test(key)
    || /^(sno|slno|sn|serial|srno|si|no)$/.test(key);
}

function guessTarget(header: string): TargetField {
  const key = normalise(header);
  if (!key) return 'ignore';
  if (isPlaceholderHeader(header)) return 'ignore';
  for (const [field, re] of HEADER_RULES) {
    if (re.test(key)) return field;
  }
  return 'ignore';
}

/**
 * Finds the header row: the first row within the first 20 whose cells map to a
 * name column plus at least one amount column. Files often have a title or
 * blank rows above the real header.
 */
export function detectHeaderRow(grid: Grid): number {
  const limit = Math.min(grid.length, 20);

  let bestRow = -1;
  let bestScore = 0;

  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? [];
    if (!row.some((c) => c)) continue;

    const targets = row.map(guessTarget);
    const recognised = new Set(targets.filter((t) => t !== 'ignore'));
    const hasName = recognised.has('name');
    const hasAmount = [...recognised].some((t) => (AMOUNT_FIELDS as readonly string[]).includes(t));

    // A row naming a client and at least one amount is unambiguous; take it.
    if (hasName && hasAmount) return r;

    if (recognised.size > bestScore) {
      bestScore = recognised.size;
      bestRow = r;
    }
  }

  // Nothing conclusive. Prefer the row that recognised the most fields, then
  // the first row carrying real labels. Falling back to row 0 is wrong when a
  // workbook opens with Excel's "Column1, Column2, ..." filler, which would
  // otherwise be mapped as the header and yield no rows at all.
  if (bestRow !== -1) return bestRow;

  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? [];
    const labels = row.filter((c) => c && !isPlaceholderHeader(c));
    if (labels.length >= 2) return r;
  }

  return 0;
}

export type ColumnMap = TargetField[];

/** Initial guess for what each column means; the user can correct it in the UI. */
export function autoMap(headers: string[]): ColumnMap {
  const used = new Set<TargetField>();
  return headers.map((h) => {
    const guess = guessTarget(h);
    // Never map two columns to the same field automatically.
    if (guess !== 'ignore' && used.has(guess)) return 'ignore';
    if (guess !== 'ignore') used.add(guess);
    return guess;
  });
}

/**
 * Parses a spreadsheet cell into a number. Tolerates "1,264,500", "(1500)" for
 * negatives, currency prefixes, and stray whitespace. Blank means zero.
 */
export function parseAmount(raw: string): number {
  const s = (raw ?? '').trim();
  if (!s) return 0;

  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  const digits = s.replace(/[()\-]/g, '').replace(/[^\d.]/g, '');
  if (!digits) return 0;

  const n = Number(digits);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

export type ImportRow = {
  rowNumber: number;
  name: string;
  address: string;
  pan_number: string;
  phone: string;
  amounts: Record<AmountField, number>;
};

export type ExtractResult = {
  headers: string[];
  map: ColumnMap;
  headerRow: number;
  rows: ImportRow[];
  /** Count of non-blank rows dropped for having no client name (totals rows). */
  ignored: number;
};

/**
 * Turns a raw grid into import rows. Rows with no client name are dropped,
 * which is what removes trailing grand-total rows.
 */
export function extractRows(grid: Grid, headerRow: number, map: ColumnMap): ImportRow[] {
  const rows: ImportRow[] = [];

  for (let r = headerRow + 1; r < grid.length; r++) {
    const cells = grid[r] ?? [];
    if (!cells.some((c) => c)) continue;

    const get = (field: TargetField): string => {
      const idx = map.indexOf(field);
      return idx === -1 ? '' : (cells[idx] ?? '').trim();
    };

    const name = get('name');
    if (!name) continue;

    rows.push({
      rowNumber: r + 1,
      name,
      address: get('address'),
      pan_number: get('pan_number'),
      phone: get('phone'),
      amounts: Object.fromEntries(
        AMOUNT_FIELDS.map((f) => [f, parseAmount(get(f))]),
      ) as Record<AmountField, number>,
    });
  }

  return rows;
}

export function extract(grid: Grid): ExtractResult {
  const headerRow = detectHeaderRow(grid);
  const headers = (grid[headerRow] ?? []).map((h, i) => h || `Column ${i + 1}`);
  const map = autoMap(grid[headerRow] ?? []);
  const rows = extractRows(grid, headerRow, map);

  let nonBlank = 0;
  for (let r = headerRow + 1; r < grid.length; r++) {
    if ((grid[r] ?? []).some((c) => c)) nonBlank++;
  }

  return { headers, map, headerRow, rows, ignored: nonBlank - rows.length };
}

/**
 * Column indexes worth showing in the mapping UI: those holding data below the
 * header, plus any with a meaningful header of their own. A workbook whose
 * table is declared across all 16,384 columns would otherwise render 16,384
 * rows of nothing.
 *
 * Computed in a single pass over the grid rather than per-column, since the
 * naive form is columns x rows cell reads.
 */
export function usefulColumns(grid: Grid, headerRow: number, map: ColumnMap): number[] {
  const header = grid[headerRow] ?? [];
  const width = Math.max(header.length, map.length,
    ...grid.slice(headerRow + 1, headerRow + 200).map((r) => r?.length ?? 0));

  const hasData = new Uint8Array(width);
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length && c < width; c++) {
      if (!hasData[c] && (row[c] ?? '').trim()) hasData[c] = 1;
    }
  }

  const out: number[] = [];
  for (let c = 0; c < width; c++) {
    const named = !isPlaceholderHeader(header[c] ?? '');
    if (hasData[c] || named || (map[c] && map[c] !== 'ignore')) out.push(c);
  }
  return out;
}

/** First non-blank value under a column, for the mapping preview. */
export function sampleValue(grid: Grid, headerRow: number, col: number): string {
  for (let r = headerRow + 1; r < grid.length; r++) {
    const v = (grid[r]?.[col] ?? '').trim();
    if (v) return v;
  }
  return '';
}
