'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { TARGET_LABELS } from '@/lib/mapping';
import { formatAmount, type Grouping } from '@/lib/format';
import { AMOUNT_FIELDS, type AmountField, type Client } from '@/lib/types';
import { blankRow, type RowDraft } from './types';

type Props = {
  rows: RowDraft[];
  setRows: (rows: RowDraft[]) => void;
  grouping: Grouping;
};

let seq = 0;
const nextKey = () => `m${Date.now().toString(36)}${seq++}`;

export default function ManualTab({ rows, setRows, grouping }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api<Client[]>('/api/clients').then(setClients).catch((e) => setLoadError(e.message));
  }, []);

  // Start with one empty line so the tab is usable immediately.
  useEffect(() => {
    if (!rows.length) setRows([blankRow(nextKey())]);
    // Intentionally only on mount: adding rows later must not retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byName = useMemo(
    () => new Map(clients.map((c) => [c.name.trim().toLowerCase(), c])),
    [clients],
  );

  function patch(key: string, changes: Partial<RowDraft>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  }

  function setAmount(key: string, field: AmountField, raw: string) {
    setRows(rows.map((r) => {
      if (r.key !== key) return r;
      const n = raw.trim() === '' ? 0 : Number(raw);
      return { ...r, amounts: { ...r.amounts, [field]: Number.isFinite(n) ? n : 0 } };
    }));
  }

  /** Typing or picking a known client name pulls its address and PAN across. */
  function setName(key: string, name: string) {
    const match = byName.get(name.trim().toLowerCase());
    setRows(rows.map((r) => {
      if (r.key !== key) return r;
      if (!match) return { ...r, name };
      return {
        ...r,
        name: match.name,
        address: r.address || match.address,
        pan_number: r.pan_number || match.pan_number,
        phone: r.phone || match.phone,
      };
    }));
  }

  const totals = useMemo(() => {
    const t = Object.fromEntries(AMOUNT_FIELDS.map((f) => [f, 0])) as Record<AmountField, number>;
    for (const r of rows) if (r.selected) for (const f of AMOUNT_FIELDS) t[f] += r.amounts[f];
    return t;
  }, [rows]);

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Enter the figures</h2>
        <div className="spacer" />
        <button className="sm" onClick={() => setRows([...rows, blankRow(nextKey())])}>Add a row</button>
      </div>

      {loadError && <div className="msg err">{loadError}</div>}

      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Start typing a client name to autocomplete from your saved clients — the address and PAN come with it.
        A name that is not on the list is fine too; it becomes a new client if you save.
      </p>

      <datalist id="client-names">
        {clients.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>

      {rows.map((r, i) => (
        <div key={r.key} className="panel" style={{ background: '#fafbfc', marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <label className="chk">
              <input type="checkbox" checked={r.selected} onChange={() => patch(r.key, { selected: !r.selected })} />
              Include
            </label>
            <span className="badge">Letter {i + 1}</span>
            <div className="spacer" />
            {rows.length > 1 && (
              <button className="sm danger" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                Remove
              </button>
            )}
          </div>

          <div className="grid3">
            <div className="field">
              <label>Client name *</label>
              <input
                type="text" list="client-names" value={r.name}
                onChange={(e) => setName(r.key, e.target.value)}
                placeholder="Ram Dular Suppliers"
              />
            </div>
            <div className="field">
              <label>PAN number</label>
              <input
                type="text" value={r.pan_number}
                onChange={(e) => patch(r.key, { pan_number: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Address</label>
              <input
                type="text" value={r.address}
                onChange={(e) => patch(r.key, { address: e.target.value })}
              />
            </div>
          </div>

          <div className="grid3">
            {AMOUNT_FIELDS.map((f) => (
              <div className="field" key={f}>
                <label>{TARGET_LABELS[f]}</label>
                <input
                  type="number" step="0.01" className="num"
                  value={r.amounts[f] === 0 ? '' : r.amounts[f]}
                  placeholder="0"
                  onChange={(e) => setAmount(r.key, f, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {rows.filter((r) => r.selected).length > 1 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Total across included rows</th>
                {AMOUNT_FIELDS.map((f) => <th key={f} className="num">{TARGET_LABELS[f]}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sub">{rows.filter((r) => r.selected).length} letters</td>
                {AMOUNT_FIELDS.map((f) => (
                  <td key={f} className="num">{formatAmount(totals[f], grouping)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
