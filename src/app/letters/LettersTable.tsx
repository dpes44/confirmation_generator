'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { downloadMerged, downloadSingle, downloadZip } from '@/lib/pdf-output';
import { formatAmount, formatLetterDate } from '@/lib/format';
import type { Company, LetterWithClient } from '@/lib/types';
import type { LetterData } from '@/components/LetterPdf';
import PdfPreview from '@/components/PdfPreview';

function toLetterData(l: LetterWithClient): LetterData {
  return {
    client_name: l.client_name,
    client_address: l.client_address,
    client_pan: l.client_pan,
    fiscal_year: l.fiscal_year,
    subject: l.subject,
    letter_date: l.letter_date,
    opening_date_bs: l.opening_date_bs,
    closing_date_bs: l.closing_date_bs,
    opening_balance: l.opening_balance,
    sales: l.sales,
    purchases: l.purchases,
    sales_return: l.sales_return,
    purchases_return: l.purchases_return,
    purchase_annex13: l.purchase_annex13,
    sales_annex13: l.sales_annex13,
    annex13: l.annex13,
    closing_balance: l.closing_balance,
  };
}

export default function LettersTable() {
  const [letters, setLetters] = useState<LetterWithClient[] | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewOf, setPreviewOf] = useState<LetterData[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [ls, c] = await Promise.all([
        api<LetterWithClient[]>('/api/letters'),
        api<Company>('/api/company'),
      ]);
      setLetters(ls);
      setCompany(c);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const years = useMemo(
    () => [...new Set((letters ?? []).map((l) => l.fiscal_year))].sort().reverse(),
    [letters],
  );

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (letters ?? []).filter((l) => {
      if (year && l.fiscal_year !== year) return false;
      if (!term) return true;
      return `${l.client_name} ${l.client_pan} ${l.subject}`.toLowerCase().includes(term);
    });
  }, [letters, search, year]);

  const selected = useMemo(() => shown.filter((l) => picked.has(l.id)), [shown, picked]);

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function run(fn: () => Promise<void>) {
    setError('');
    setNotice('');
    try { await fn(); } catch (e: any) { setError(e?.message ?? 'Something went wrong.'); }
    setProgress(null);
  }

  async function removeSelected() {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} saved letter${selected.length === 1 ? '' : 's'}? The clients are kept.`)) return;
    await run(async () => {
      await api('/api/letters', { method: 'DELETE', body: JSON.stringify({ ids: selected.map((l) => l.id) }) });
      setPicked(new Set());
      await load();
      setNotice('Deleted.');
    });
  }

  const allShownPicked = shown.length > 0 && shown.every((l) => picked.has(l.id));

  return (
    <>
      <div className="page-head">
        <h1>Saved letters</h1>
        {letters && <span className="badge">{letters.length}</span>}
        <div className="spacer" />
        <Link href="/generate"><button className="primary">Generate letters</button></Link>
      </div>

      {error && <div className="msg err">{error}</div>}
      {notice && <div className="msg ok">{notice}</div>}

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            type="text" placeholder="Search by client, PAN, or subject…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 170 }}>
            <option value="">All fiscal years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="spacer" />
          <span className="sub" style={{ fontSize: 12 }}>{selected.length} selected</span>
        </div>

        {selected.length > 0 && company && (
          <div className="row" style={{ marginBottom: 12 }}>
            <button onClick={() => setPreviewOf(selected.slice(0, 20).map(toLetterData))}>
              Preview{selected.length > 20 ? ' (first 20)' : ''}
            </button>
            <button className="primary" onClick={() => run(() =>
              downloadMerged(company, selected.map(toLetterData), 'confirmation-letters.pdf'))}>
              Download one PDF
            </button>
            <button onClick={() => run(() =>
              downloadZip(company, selected.map(toLetterData), (done, total) => setProgress({ done, total })))}>
              Download zip
            </button>
            <div className="spacer" />
            <button className="danger" onClick={removeSelected}>Delete selected</button>
          </div>
        )}

        {progress && (
          <div style={{ marginBottom: 12 }}>
            <progress value={progress.done} max={progress.total} style={{ width: '100%' }} />
            <div className="hint">Rendering {progress.done} of {progress.total}…</div>
          </div>
        )}

        {letters === null ? (
          <div className="empty">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="empty">
            {letters.length === 0
              ? <>Nothing saved yet. Letters appear here when you press &ldquo;Save to database&rdquo; on the <Link href="/generate">Generate</Link> screen.</>
              : 'No letters match those filters.'}
          </div>
        ) : (
          <div className="tablewrap scroll-y">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox" checked={allShownPicked}
                      onChange={() => setPicked(allShownPicked ? new Set() : new Set(shown.map((l) => l.id)))}
                    />
                  </th>
                  <th>Client</th>
                  <th>Fiscal year</th>
                  <th>Letter date</th>
                  <th className="num">Sales</th>
                  <th className="num">Purchases</th>
                  <th className="num">Closing</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id}>
                    <td><input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} /></td>
                    <td>{l.client_name}</td>
                    <td>{l.fiscal_year}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatLetterDate(l.letter_date)}</td>
                    <td className="num">{formatAmount(l.sales, company?.number_grouping ?? 'none')}</td>
                    <td className="num">{formatAmount(l.purchases, company?.number_grouping ?? 'none')}</td>
                    <td className="num">{formatAmount(l.closing_balance, company?.number_grouping ?? 'none')}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {company && (
                        <button className="sm" onClick={() => run(() => downloadSingle(company, toLetterData(l)))}>
                          PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewOf && company && (
        <PdfPreview company={company} letters={previewOf} onClose={() => setPreviewOf(null)} />
      )}
    </>
  );
}
