'use client';

import { useEffect, useState } from 'react';
import { blobForPreview } from '@/lib/pdf-output';
import type { LetterData } from '@/components/LetterPdf';
import type { Company } from '@/lib/types';

/**
 * Renders letters to a blob and shows them in an iframe. Using the browser's
 * own PDF viewer rather than a canvas-based one means what you see is the file
 * you will download.
 */
export default function PdfPreview({
  company,
  letters,
  onClose,
}: {
  company: Company;
  letters: LetterData[];
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let revoked = false;
    let made = '';
    setUrl('');
    setError('');

    blobForPreview(company, letters)
      .then((u) => {
        if (revoked) { URL.revokeObjectURL(u); return; }
        made = u;
        setUrl(u);
      })
      .catch((e: any) => setError(e?.message ?? 'Could not render the preview.'));

    return () => {
      revoked = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [company, letters]);

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Preview</h2>
        <span className="badge">{letters.length} page{letters.length === 1 ? '' : 's'}</span>
        <div className="spacer" />
        <button className="sm" onClick={onClose}>Close preview</button>
      </div>

      {error && <div className="msg err">{error}</div>}
      {!url && !error && <div className="empty">Rendering…</div>}
      {url && (
        <iframe
          src={url}
          title="Letter preview"
          style={{ width: '100%', height: '78vh', border: '1px solid var(--line)', borderRadius: 4, background: '#fff' }}
        />
      )}
    </div>
  );
}
