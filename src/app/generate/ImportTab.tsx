'use client';

import { useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { readSpreadsheet, type Grid } from '@/lib/spreadsheet';
import {
  extract, extractRows, sampleValue, usefulColumns,
  TARGET_LABELS, type ColumnMap, type TargetField,
} from '@/lib/mapping';
import { formatAmount, type Grouping } from '@/lib/format';
import { AMOUNT_FIELDS, type Client } from '@/lib/types';
import type { RowDraft } from './types';

const TARGET_ORDER: TargetField[] = [
  'ignore', 'name', 'address', 'pan_number', 'phone', ...AMOUNT_FIELDS,
];

type Props = {
  rows: RowDraft[];
  setRows: (rows: RowDraft[]) => void;
  onFileName: (name: string) => void;
  onError: (msg: string) => void;
  grouping: Grouping;
};

export default function ImportTab({ rows, setRows, onFileName, onError, grouping }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<ColumnMap>([]);
  const [fileName, setFileName] = useState('');
  const [ignored, setIgnored] = useState(0);
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState('');

  function toDrafts(g: Grid, hRow: number, m: ColumnMap): RowDraft[] {
    return extractRows(g, hRow, m).map((r) => ({
      key: `r${r.rowNumber}`,
      name: r.name,
      address: r.address,
      pan_number: r.pan_number,
      phone: r.phone,
      amounts: r.amounts,
      selected: true,
      sourceRow: r.rowNumber,
    }));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    onError('');
    setEnrichNote('');
    try {
      const g = await readSpreadsheet(file);
      if (!g.length) throw new Error('That file appears to be empty.');

      const res = extract(g);
      if (!res.rows.length) {
        throw new Error(
          'No rows could be read. Check that the sheet has a header row with a client-name column, then map the columns below.',
        );
      }

      setGrid(g);
      setHeaderRow(res.headerRow);
      setMap(res.map);
      setIgnored(res.ignored);
      setFileName(file.name);
      onFileName(file.name);
      setRows(toDrafts(g, res.headerRow, res.map));
    } catch (e: any) {
      onError(e?.message ?? 'Could not read that file.');
    }
  }

  function remap(col: number, target: TargetField) {
    if (!grid) return;
    const next = [...map];
    // A field can only come from one column, so clear any previous holder.
    if (target !== 'ignore') {
      for (let i = 0; i < next.length; i++) if (next[i] === target) next[i] = 'ignore';
    }
    next[col] = target;
    setMap(next);
    setRows(toDrafts(grid, headerRow, next));
  }

  function changeHeaderRow(n: number) {
    if (!grid) return;
    const clamped = Math.max(0, Math.min(grid.length - 1, n));
    setHeaderRow(clamped);
    setRows(toDrafts(grid, clamped, map));
  }

  /** Fills blank address/PAN/phone from saved clients, matching on name. */
  async function enrich() {
    setEnriching(true);
    setEnrichNote('');
    try {
      const clients = await api<Client[]>('/api/clients');
      const byName = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c]));
      let filled = 0;
      const next = rows.map((r) => {
        const match = byName.get(r.name.trim().toLowerCase());
        if (!match) return r;
        const merged = {
          ...r,
          address: r.address || match.address,
          pan_number: r.pan_number || match.pan_number,
          phone: r.phone || match.phone,
        };
        if (merged.address !== r.address || merged.pan_number !== r.pan_number) filled++;
        return merged;
      });
      setRows(next);
      setEnrichNote(
        filled > 0
          ? `Filled details on ${filled} row${filled === 1 ? '' : 's'} from saved clients.`
          : 'No saved client matched a row with missing details.',
      );
    } catch (e: any) {
      onError(e.message);
    } finally {
      setEnriching(false);
    }
  }

  const headers = useMemo(
    () => (grid?.[headerRow] ?? []).map((h, i) => h || `Column ${i + 1}`),
    [grid, headerRow],
  );

  // Only offer columns that hold data or carry a real header. Excel workbooks
  // often declare a table across all 16,384 columns with "Column12"-style
  // filler headers, which would otherwise flood this list.
  const usefulCols = useMemo(
    () => (grid ? usefulColumns(grid, headerRow, map) : []),
    [grid, headerRow, map],
  );

  const selectedCount = rows.filter((r) => r.selected).length;
  const missingPan = rows.filter((r) => r.selected && !r.pan_number.trim()).length;
  const missingAddress = rows.filter((r) => r.selected && !r.address.trim()).length;
  const nameMapped = map.includes('name');

  function setAll(selected: boolean) {
    setRows(rows.map((r) => ({ ...r, selected })));
  }

  function toggle(key: string) {
    setRows(rows.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));
  }

  return (
    <>
      <div className="panel">
        <h2>1. Choose the file</h2>
        <div
          className={`drop${over ? ' over' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <strong>{fileName || 'Drop a spreadsheet here, or click to browse'}</strong>
          .xlsx or .csv — the columns are matched to fields automatically
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xlsm,.csv,.txt,text/csv"
          hidden
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
        />
        {fileName && (
          <div className="hint" style={{ marginTop: 8 }}>
            Read {rows.length} row{rows.length === 1 ? '' : 's'} from <strong>{fileName}</strong>
            {ignored > 0 && ` · ${ignored} row${ignored === 1 ? '' : 's'} ignored for having no client name (totals rows and the like)`}
          </div>
        )}
      </div>

      {grid && (
        <div className="panel">
          <h2>2. Check the column mapping</h2>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 0, maxWidth: 190 }}>
              <label>Header is on row</label>
              <input
                type="number" min={1} max={grid.length}
                value={headerRow + 1}
                onChange={(e) => changeHeaderRow(Number(e.target.value) - 1)}
              />
            </div>
            <div className="hint" style={{ alignSelf: 'flex-end' }}>
              Change this if the header was detected on the wrong row.
            </div>
          </div>

          {!nameMapped && (
            <div className="msg err">
              No column is mapped to <strong>Client name</strong>. Pick one below — nothing can be generated without it.
            </div>
          )}

          <div className="tablewrap scroll-y">
            <table>
              <thead>
                <tr><th>Column in file</th><th>First value</th><th style={{ width: 230 }}>Use as</th></tr>
              </thead>
              <tbody>
                {usefulCols.map((c) => (
                  <tr key={c}>
                    <td>{headers[c]}</td>
                    <td className="sub">{sampleValue(grid, headerRow, c) || '—'}</td>
                    <td>
                      <select value={map[c] ?? 'ignore'} onChange={(e) => remap(c, e.target.value as TargetField)}>
                        {TARGET_ORDER.map((t) => (
                          <option key={t} value={t}>{TARGET_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="panel">
          <h2>3. Pick the rows</h2>

          {(missingPan > 0 || missingAddress > 0) && (
            <div className="msg warn">
              <div>
                {missingAddress > 0 && <>{missingAddress} selected row{missingAddress === 1 ? ' has' : 's have'} no address. </>}
                {missingPan > 0 && <>{missingPan} selected row{missingPan === 1 ? ' has' : 's have'} no PAN number. </>}
                Those lines are simply left off the letter.
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="sm" onClick={enrich} disabled={enriching}>
                  {enriching ? 'Looking up…' : 'Fill from saved clients'}
                </button>
                {enrichNote && <span className="hint" style={{ marginTop: 0 }}>{enrichNote}</span>}
              </div>
            </div>
          )}

          <div className="row" style={{ marginBottom: 10 }}>
            <button className="sm" onClick={() => setAll(true)}>Select all</button>
            <button className="sm" onClick={() => setAll(false)}>Select none</button>
            <div className="spacer" />
            <span className="sub" style={{ fontSize: 12 }}>{selectedCount} of {rows.length} selected</span>
          </div>

          <div className="tablewrap scroll-y">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }} />
                  <th style={{ width: 48 }}>Row</th>
                  <th>Client</th>
                  <th>PAN</th>
                  <th>Address</th>
                  {AMOUNT_FIELDS.map((f) => (
                    <th key={f} className="num">{TARGET_LABELS[f]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} style={r.selected ? undefined : { opacity: 0.45 }}>
                    <td>
                      <input type="checkbox" checked={r.selected} onChange={() => toggle(r.key)} />
                    </td>
                    <td className="sub">{r.sourceRow}</td>
                    <td>{r.name}</td>
                    <td>{r.pan_number || <span className="sub">—</span>}</td>
                    <td>{r.address || <span className="sub">—</span>}</td>
                    {AMOUNT_FIELDS.map((f) => (
                      <td key={f} className="num">
                        {r.amounts[f] ? formatAmount(r.amounts[f], grouping) : <span className="sub">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
