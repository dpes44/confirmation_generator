'use client';

import { useEffect, useState } from 'react';
import { api, fileToDataUri } from '@/lib/api';
import type { Company } from '@/lib/types';

type ImageField = 'logo_data' | 'signature_data' | 'stamp_data';

const IMAGES: Array<{ field: ImageField; label: string; hint: string }> = [
  { field: 'logo_data', label: 'Logo', hint: 'Appears top-left. A transparent PNG works best.' },
  { field: 'signature_data', label: 'Signature', hint: 'Scanned signature, ideally with a transparent or white background.' },
  { field: 'stamp_data', label: 'Company stamp', hint: 'Printed beside the signature.' },
];

export default function SettingsForm() {
  const [c, setC] = useState<Company | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Company>('/api/company').then(setC).catch((e) => setMsg({ kind: 'err', text: e.message }));
  }, []);

  function set<K extends keyof Company>(key: K, value: Company[K]) {
    setC((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function pickImage(field: ImageField, file: File | undefined) {
    if (!file) return;
    try {
      set(field, (await fileToDataUri(file)) as any);
      setMsg(null);
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    }
  }

  async function save() {
    if (!c) return;
    setBusy(true);
    setMsg(null);
    try {
      setC(await api<Company>('/api/company', { method: 'PUT', body: JSON.stringify(c) }));
      setMsg({ kind: 'ok', text: 'Saved. New letters will use these details.' });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!c) {
    return (
      <>
        <div className="page-head"><h1>Company settings</h1></div>
        {msg ? <div className={`msg ${msg.kind === 'err' ? 'err' : 'ok'}`}>{msg.text}</div> : <div className="empty">Loading…</div>}
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Company settings</h1>
        <span className="sub">Everything here is constant across letters.</span>
        <div className="spacer" />
        <button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>

      {msg && <div className={`msg ${msg.kind === 'err' ? 'err' : 'ok'}`}>{msg.text}</div>}

      <div className="panel">
        <h2>Company details</h2>
        <div className="grid2">
          <div className="field">
            <label>Company name</label>
            <input type="text" value={c.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>PAN number</label>
            <input type="text" value={c.pan_number} onChange={(e) => set('pan_number', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Address</label>
          <input type="text" value={c.address} onChange={(e) => set('address', e.target.value)} />
        </div>
      </div>

      <div className="panel">
        <h2>Logo, signature &amp; stamp</h2>
        <div className="grid3">
          {IMAGES.map(({ field, label, hint }) => (
            <div key={field} className="field">
              <label>{label}</label>
              {c[field] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="imgprev" src={c[field] as string} alt={label} />
              ) : (
                <div className="hint" style={{ marginBottom: 6 }}>Not set</div>
              )}
              <div className="row" style={{ marginTop: 6 }}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ fontSize: 12, border: 'none', padding: 0, width: 'auto' }}
                  onChange={(e) => pickImage(field, e.target.files?.[0])}
                />
                {c[field] && <button className="sm danger" onClick={() => set(field, null as any)}>Remove</button>}
              </div>
              <div className="hint">{hint}</div>
            </div>
          ))}
        </div>
        <div className="hint">Images are stored in the database as part of the company record, so there is no file storage to configure. Keep each under about 900 KB.</div>
      </div>

      <div className="panel">
        <h2>Signatory</h2>
        <div className="grid3">
          <div className="field">
            <label>Name</label>
            <input type="text" value={c.signatory_name} onChange={(e) => set('signatory_name', e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input type="text" value={c.signatory_phone} onChange={(e) => set('signatory_phone', e.target.value)} />
          </div>
          <div className="field">
            <label>Line under the signature</label>
            <input type="text" value={c.signatory_title} onChange={(e) => set('signatory_title', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Letter wording</h2>
        <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>
          Placeholders you can use: <code>{'{{closing_date}}'}</code> <code>{'{{opening_date}}'}</code>{' '}
          <code>{'{{fiscal_year}}'}</code> <code>{'{{days}}'}</code> <code>{'{{phone}}'}</code>{' '}
          <code>{'{{signatory}}'}</code> <code>{'{{company}}'}</code> <code>{'{{client}}'}</code>{' '}
          <code>{'{{currency}}'}</code>
        </p>

        <div className="field">
          <label>Default subject line</label>
          <input type="text" value={c.tpl_subject} onChange={(e) => set('tpl_subject', e.target.value)} />
          <div className="hint">Used when you leave the subject blank while generating. You can override it per batch.</div>
        </div>
        <div className="field">
          <label>Salutation</label>
          <input type="text" value={c.tpl_salutation} onChange={(e) => set('tpl_salutation', e.target.value)} />
        </div>
        <div className="field">
          <label>Opening paragraph</label>
          <textarea value={c.tpl_intro} onChange={(e) => set('tpl_intro', e.target.value)} />
        </div>
        <div className="field">
          <label>Paragraph after the table</label>
          <textarea value={c.tpl_confirm_note} onChange={(e) => set('tpl_confirm_note', e.target.value)} />
        </div>
        <div className="field">
          <label>Contact line</label>
          <input type="text" value={c.tpl_contact} onChange={(e) => set('tpl_contact', e.target.value)} />
        </div>
        <div className="grid3">
          <div className="field">
            <label>Days allowed to confirm</label>
            <input
              type="number"
              min={0}
              value={c.confirm_days}
              onChange={(e) => set('confirm_days', Number(e.target.value) as any)}
            />
          </div>
          <div className="field">
            <label>Currency label</label>
            <input type="text" value={c.currency_label} onChange={(e) => set('currency_label', e.target.value)} />
            <div className="hint">Shown in the amount column heading.</div>
          </div>
          <div className="field">
            <label>Number formatting</label>
            <select value={c.number_grouping} onChange={(e) => set('number_grouping', e.target.value as any)}>
              <option value="none">1264500 (no separators)</option>
              <option value="western">1,264,500</option>
              <option value="nepali">12,64,500 (lakh)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Balance table rows</h2>
        <p className="hint" style={{ marginTop: -4, marginBottom: 10 }}>
          One row per line, written as <code>field|Label</code>. Delete a line to drop that row from the
          table, or reorder lines to change the order. Valid fields: <code>opening_balance</code>,{' '}
          <code>sales</code>, <code>purchases</code>, <code>sales_return</code>,{' '}
          <code>purchases_return</code>, <code>annex13</code>, <code>closing_balance</code>.
        </p>
        <textarea
          rows={8}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}
          value={c.tpl_table_rows}
          onChange={(e) => set('tpl_table_rows', e.target.value)}
        />
      </div>

      <div className="panel">
        <h2>Footer</h2>
        <div className="field">
          <label>Footer lines</label>
          <textarea rows={3} value={c.footer_lines} onChange={(e) => set('footer_lines', e.target.value)} />
          <div className="hint">One line each, centred at the foot of every page. The last line is printed in bold.</div>
        </div>
      </div>

      <div className="row">
        <button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </>
  );
}
