import { unzipSync, strFromU8 } from 'fflate';

/**
 * Minimal client-side XLSX + CSV reader.
 *
 * An .xlsx file is a zip of XML, so `fflate` plus DOMParser is enough to read
 * the first worksheet. This avoids pulling in a multi-megabyte spreadsheet
 * library (and the known advisories against the npm `xlsx` build) for what is
 * really just "read a rectangular grid of cells".
 */

export type Grid = string[][];

const A = 'A'.charCodeAt(0);

/** "BC12" -> 28 (zero-based column index). */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < A || c > A + 25) break;
    n = n * 26 + (c - A + 1);
  }
  return n - 1;
}

function textOf(el: Element | null): string {
  return el ? (el.textContent ?? '') : '';
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('The spreadsheet contains XML this reader could not parse.');
  }
  return doc;
}

export function readXlsx(buf: ArrayBuffer): Grid {
  const files = unzipSync(new Uint8Array(buf));

  const findFile = (re: RegExp) => Object.keys(files).find((k) => re.test(k));

  // Shared strings: most text cells are pointers into this table.
  const sstPath = findFile(/^xl\/sharedStrings\.xml$/i);
  const shared: string[] = [];
  if (sstPath) {
    const doc = parseXml(strFromU8(files[sstPath]));
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      // Concatenate every <t>, which handles runs of mixed formatting.
      shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
    }
  }

  // Resolve the first sheet by walking workbook.xml -> rels, falling back to
  // whichever sheet XML exists if the relationship graph is unusual.
  let sheetPath: string | undefined;
  const wbPath = findFile(/^xl\/workbook\.xml$/i);
  const relPath = findFile(/^xl\/_rels\/workbook\.xml\.rels$/i);
  if (wbPath && relPath) {
    const wb = parseXml(strFromU8(files[wbPath]));
    const firstSheet = wb.getElementsByTagName('sheet')[0];
    const rid = firstSheet?.getAttribute('r:id') ?? firstSheet?.getAttribute('id');
    if (rid) {
      const rels = parseXml(strFromU8(files[relPath]));
      for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
        if (rel.getAttribute('Id') === rid) {
          const target = (rel.getAttribute('Target') ?? '').replace(/^\/?xl\//, '').replace(/^\//, '');
          sheetPath = findFile(new RegExp(`^xl/${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
          break;
        }
      }
    }
  }
  sheetPath ??= findFile(/^xl\/worksheets\/sheet1\.xml$/i) ?? findFile(/^xl\/worksheets\/.*\.xml$/i);
  if (!sheetPath) throw new Error('No worksheet found inside the .xlsx file.');

  const sheet = parseXml(strFromU8(files[sheetPath]));
  const grid: Grid = [];

  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r') ?? '';
      const idx = ref ? colIndex(ref) : cells.length;
      const type = c.getAttribute('t');

      let value = '';
      if (type === 'inlineStr') {
        value = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
      } else {
        const raw = textOf(c.getElementsByTagName('v')[0]);
        if (type === 's') {
          value = shared[Number(raw)] ?? '';
        } else if (type === 'b') {
          value = raw === '1' ? 'TRUE' : 'FALSE';
        } else {
          value = raw;
        }
      }

      while (cells.length < idx) cells.push('');
      cells[idx] = value.trim();
    }
    // `row` carries its own 1-based index; honour it so blank rows are kept and
    // column alignment cannot drift.
    const rowIdx = Number(row.getAttribute('r') ?? grid.length + 1) - 1;
    while (grid.length < rowIdx) grid.push([]);
    grid[rowIdx] = cells;
  }

  return grid;
}

/** RFC 4180 CSV reader: handles quoted fields, embedded commas, newlines and "". */
export function readCsv(text: string, delimiter = ','): Grid {
  const grid: Grid = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Strip a UTF-8 BOM, which Excel loves to add.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; }
    else if (ch === delimiter) { row.push(field.trim()); field = ''; }
    else if (ch === '\r') { /* handled by the \n that follows */ }
    else if (ch === '\n') { row.push(field.trim()); grid.push(row); row = []; field = ''; }
    else { field += ch; }
  }
  if (field !== '' || row.length) { row.push(field.trim()); grid.push(row); }

  return grid;
}

/** Picks the delimiter by counting candidates outside quotes on the first line. */
function sniffDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const outside = firstLine.replace(/"[^"]*"/g, '');
  const counts = [',', ';', '\t', '|'].map((d) => [d, outside.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

export async function readSpreadsheet(file: File): Promise<Grid> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    return readXlsx(await file.arrayBuffer());
  }
  if (name.endsWith('.xls')) {
    throw new Error('Legacy .xls files are not supported. Open it in Excel and "Save As" .xlsx or .csv.');
  }
  const text = await file.text();
  return readCsv(text, sniffDelimiter(text));
}
