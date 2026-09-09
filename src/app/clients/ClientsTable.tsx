'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Client } from '@/lib/types';

const BLANK: Client = { id: 0, name: '', address: '', pan_number: '', phone: '', notes: '' };

export default function ClientsTable() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setClients(await api<Client[]>('/api/clients'));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtering client-side keeps typing instant; the list is capped at 2000 rows.
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || !clients) return clients ?? [];
    return clients.filter((c) =>
      `${c.name} ${c.pan_number} ${c.address} ${c.phone}`.toLowerCase().includes(term));
  }, [clients, search]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      if (editing.id) {
        await api(`/api/clients/${editing.id}`, { method: 'PUT', body: JSON.stringify(editing) });
      } else {
        await api('/api/clients', { method: 'POST', body: JSON.stringify(editing) });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e.message.includes('duplicate key') || e.message.includes('unique')
        ? 'A client with that name already exists.'
        : e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Client) {
    if (!confirm(`Delete "${c.name}"? Any saved letters for this client are deleted too.`)) return;
    setError('');
    try {
      await api(`/api/clients/${c.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Clients</h1>
        {clients && <span className="badge">{clients.length}</span>}
        <div className="spacer" />
        <button className="primary" onClick={() => setEditing({ ...BLANK })}>Add client</button>
      </div>

      {error && <div className="msg err">{error}</div>}

      {editing && (
        <div className="panel">
          <h2>{editing.id ? 'Edit client' : 'New client'}</h2>
          <div className="grid2">
            <div className="field">
              <label>Name *</label>
              <input
                type="text" autoFocus value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <div className="hint">Printed after &ldquo;M/S&rdquo; on the letter.</div>
            </div>
            <div className="field">
              <label>PAN number</label>
              <input
                type="text" value={editing.pan_number}
                onChange={(e) => setEditing({ ...editing, pan_number: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Address</label>
              <input
                type="text" value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                type="text" value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Notes (never printed)</label>
            <input
              type="text" value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
            />
          </div>
          <div className="row">
            <button className="primary" onClick={save} disabled={busy || !editing.name.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(null); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            type="text" placeholder="Search by name, PAN, or address…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 340 }}
          />
          {search && <button className="sm" onClick={() => setSearch('')}>Clear</button>}
          <div className="spacer" />
          <span className="sub" style={{ fontSize: 12 }}>{shown.length} shown</span>
        </div>

        {clients === null ? (
          <div className="empty">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="empty">
            {clients.length === 0 ? (
              <>No clients yet. Add one above, or <Link href="/generate">import a spreadsheet</Link>.</>
            ) : (
              'No clients match that search.'
            )}
          </div>
        ) : (
          <div className="tablewrap scroll-y">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>PAN number</th><th>Address</th><th>Phone</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.pan_number || <span className="sub">—</span>}</td>
                    <td>{c.address || <span className="sub">—</span>}</td>
                    <td>{c.phone || <span className="sub">—</span>}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="sm" onClick={() => setEditing(c)}>Edit</button>{' '}
                      <button className="sm danger" onClick={() => remove(c)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
