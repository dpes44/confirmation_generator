'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { downloadMerged, downloadZip } from '@/lib/pdf-output';
import { isBsDateShape, parseFiscalYear } from '@/lib/fiscal';
import type { Company } from '@/lib/types';
import type { LetterData } from '@/components/LetterPdf';
import PdfPreview from '@/components/PdfPreview';
import ImportTab from './ImportTab';
import ManualTab from './ManualTab';
import { BLANK_META, type Meta, type RowDraft } from './types';

/** Preview is capped so a 300-row import does not lock the tab up. */
const PREVIEW_LIMIT = 20;

export default function Generator() {
  const [company, setCompany] = useState<Company | null>(null);
  const [tab, setTab] = useState<'import' | 'manual'>('import');
  const [meta, setMeta] = useState<Meta>(BLANK_META);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [sourceFile, setSourceFile] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Company>('/api/company').then(setCompany).catch((e) => setError(e.message));
  }, []);

  // When the fiscal year is complete, ask the server for the BS dates - it
  // reuses whatever was saved for that year previously.
  const fyValid = !!parseFiscalYear(meta.fiscal_year);
  useEffect(() => {
    if (!fyValid) return;
    let stale = false;
    api<{ fiscal_year: string; opening_date_bs: string; closing_date_bs: string }>(
      `/api/letters/defaults?fy=${encodeURIComponent(meta.fiscal_year)}`,
    )
      .then((d) => {
        if (stale) return;
        setMeta((m) => ({
          ...m,
          fiscal_year: d.fiscal_year || m.fiscal_year,
          // Never overwrite dates the user has already typed.
          opening_date_bs: m.opening_date_bs || d.opening_date_bs,
          closing_date_bs: m.closing_date_bs || d.closing_date_bs,
        }));
      })
      .catch(() => { /* suggestions are best-effort */ });
    return () => { stale = true; };
  }, [fyValid, meta.fiscal_year]);

  const selected = useMemo(() => rows.filter((r) => r.selected && r.name.trim()), [rows]);

  const letters: LetterData[] = useMemo(
    () =>
      selected.map((r) => ({
        client_name: r.name.trim(),
        client_address: r.address,
        client_pan: r.pan_number,
        fiscal_year: meta.fiscal_year,
        subject: meta.subject,
        letter_date: meta.letter_date,
        opening_date_bs: meta.opening_date_bs,
        closing_date_bs: meta.closing_date_bs,
        ...r.amounts,
      })),
    [selected, meta],
  );

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!fyValid) list.push('Enter a fiscal year such as 2081/82.');
    if (!meta.letter_date) list.push('Choose a letter date.');
    if (meta.opening_date_bs && !isBsDateShape(meta.opening_date_bs)) list.push('Opening date must look like 2081/04/01.');
    if (meta.closing_date_bs && !isBsDateShape(meta.closing_date_bs)) list.push('Closing date must look like 2082/03/32.');
    if (!selected.length) list.push('Select at least one row.');
    return list;
  }, [fyValid, meta, selected.length]);

  const ready = problems.length === 0 && !!company;

  const guard = useCallback(async (fn: () => Promise<void>) => {
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    }
  }, []);

  async function doMerged() {
    if (!company) return;
    await guard(async () => {
      setProgress({ done: 0, total: letters.length });
      const stamp = meta.fiscal_year.replace('/', '-') || 'letters';
      await downloadMerged(company, letters, `confirmation-letters-${stamp}.pdf`);
      setProgress(null);
      setNotice(`Downloaded one PDF with ${letters.length} page${letters.length === 1 ? '' : 's'}.`);
    });
    setProgress(null);
  }

  async function doZip() {
    if (!company) return;
    await guard(async () => {
      const stamp = meta.fiscal_year.replace('/', '-') || 'letters';
      await downloadZip(company, letters, (done, total) => setProgress({ done, total }),
        `confirmation-letters-${stamp}.zip`);
      setProgress(null);
      setNotice(`Downloaded a zip with ${letters.length} PDF${letters.length === 1 ? '' : 's'}.`);
    });
    setProgress(null);
  }

  async function doSave() {
    setSaving(true);
    await guard(async () => {
      const res = await api<{ letters: number; clients: number }>('/api/import', {
        method: 'POST',
        body: JSON.stringify({
          label: sourceFile || `${meta.fiscal_year} batch`,
          source_file: sourceFile,
          fiscal_year: meta.fiscal_year,
          subject: meta.subject,
          letter_date: meta.letter_date,
          opening_date_bs: meta.opening_date_bs,
          closing_date_bs: meta.closing_date_bs,
          rows: selected.map((r) => ({
            name: r.name.trim(),
            address: r.address,
            pan_number: r.pan_number,
            phone: r.phone,
            amounts: r.amounts,
          })),
        }),
      });
      setNotice(`Saved ${res.letters} letter${res.letters === 1 ? '' : 's'} across ${res.clients} client${res.clients === 1 ? '' : 's'}. See Saved letters.`);
    });
    setSaving(false);
  }

  return (
    <>
      <div className="page-head">
        <h1>Generate letters</h1>
        <span className="sub">Import a spreadsheet or type the figures in.</span>
      </div>

      {error && <div className="msg err">{error}</div>}
      {notice && <div className="msg ok">{notice}</div>}
      {company && !company.logo_data && (
        <div className="msg warn">
          No logo, signature, or stamp is set yet. Add them in <Link href="/settings">Company settings</Link> so
          letters print complete.
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'import'} onClick={() => setTab('import')}>Import a file</button>
        <button role="tab" aria-selected={tab === 'manual'} onClick={() => setTab('manual')}>Enter manually</button>
      </div>

      {tab === 'import' ? (
        <ImportTab
          rows={rows}
          setRows={setRows}
          onFileName={setSourceFile}
          onError={setError}
          grouping={company?.number_grouping ?? 'none'}
        />
      ) : (
        <ManualTab rows={rows} setRows={setRows} grouping={company?.number_grouping ?? 'none'} />
      )}

      <div className="panel">
        <h2>Letter details</h2>
        <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>
          These apply to every letter in this run.
        </p>
        <div className="grid3">
          <div className="field">
            <label>Fiscal year (Nepali) *</label>
            <input
              type="text" placeholder="2081/82" value={meta.fiscal_year}
              onChange={(e) => setMeta({ ...meta, fiscal_year: e.target.value })}
            />
            {meta.fiscal_year && !fyValid && <div className="hint" style={{ color: 'var(--danger)' }}>Use two consecutive years, e.g. 2081/82.</div>}
          </div>
          <div className="field">
            <label>Letter date</label>
            <input
              type="date" value={meta.letter_date}
              onChange={(e) => setMeta({ ...meta, letter_date: e.target.value })}
            />
            <div className="hint">Printed at the top, e.g. July 18, 2025.</div>
          </div>
          <div className="field">
            <label>Opening balance date (BS)</label>
            <input
              type="text" placeholder="2081/04/01" value={meta.opening_date_bs}
              onChange={(e) => setMeta({ ...meta, opening_date_bs: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Closing balance date (BS)</label>
            <input
              type="text" placeholder="2082/03/32" value={meta.closing_date_bs}
              onChange={(e) => setMeta({ ...meta, closing_date_bs: e.target.value })}
            />
            <div className="hint">Check the day — Ashadh has 31 or 32 days depending on the year.</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Subject line</label>
            <input
              type="text"
              placeholder={company?.tpl_subject ?? 'Confirmation of Sales Transactions for the year {{fiscal_year}}'}
              value={meta.subject}
              onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
            />
            <div className="hint">
              Leave blank to use the default from Company settings. <code>{'{{fiscal_year}}'}</code> is filled in
              for you.
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <div>
            <div className="stat">{selected.length}</div>
            <div className="sub" style={{ fontSize: 12 }}>letter{selected.length === 1 ? '' : 's'} ready</div>
          </div>
          <div className="spacer" />
          <button onClick={() => setPreviewing((p) => !p)} disabled={!ready}>
            {previewing ? 'Hide preview' : `Preview${selected.length > PREVIEW_LIMIT ? ` (first ${PREVIEW_LIMIT})` : ''}`}
          </button>
          <button className="primary" onClick={doMerged} disabled={!ready || !!progress}>
            Download one PDF
          </button>
          <button onClick={doZip} disabled={!ready || !!progress}>
            Download zip (one file each)
          </button>
          <button onClick={doSave} disabled={!ready || saving}>
            {saving ? 'Saving…' : 'Save to database'}
          </button>
        </div>

        {problems.length > 0 && (
          <ul className="hint" style={{ marginBottom: 0, marginTop: 12, paddingLeft: 18 }}>
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}

        {progress && (
          <div style={{ marginTop: 12 }}>
            <progress value={progress.done} max={progress.total} style={{ width: '100%' }} />
            <div className="hint">Rendering {progress.done} of {progress.total}…</div>
          </div>
        )}

        <div className="hint" style={{ marginTop: 12 }}>
          PDFs are built in your browser, so nothing is uploaded and nothing is stored unless you press
          <strong> Save to database</strong>.
        </div>
      </div>

      {previewing && ready && company && (
        <PdfPreview
          company={company}
          letters={letters.slice(0, PREVIEW_LIMIT)}
          onClose={() => setPreviewing(false)}
        />
      )}
    </>
  );
}
