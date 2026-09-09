'use client';

import { pdf } from '@react-pdf/renderer';
import JSZip from 'jszip';
import LetterPdf, { type LetterData } from '@/components/LetterPdf';
import type { Company } from './types';

/** Makes a filesystem-safe basename from a client name. */
export function safeFileName(name: string, suffix = ''): string {
  const base = (name || 'letter')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
    .replace(/[. ]+$/, '');
  return `${base || 'letter'}${suffix}.pdf`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function renderBlob(company: Company, letters: LetterData[]): Promise<Blob> {
  return pdf(<LetterPdf company={company} letters={letters} />).toBlob();
}

/** One PDF containing every letter, one page each - handy for bulk printing. */
export async function downloadMerged(
  company: Company,
  letters: LetterData[],
  filename = 'confirmation-letters.pdf',
) {
  triggerDownload(await renderBlob(company, letters), filename);
}

export async function downloadSingle(company: Company, letter: LetterData) {
  const blob = await renderBlob(company, [letter]);
  triggerDownload(blob, safeFileName(letter.client_name, ` - ${letter.fiscal_year.replace('/', '-')}`));
}

export async function blobForPreview(company: Company, letters: LetterData[]): Promise<string> {
  return URL.createObjectURL(await renderBlob(company, letters));
}

export type Progress = (done: number, total: number) => void;

/**
 * A zip of one PDF per client. Rendering happens one letter at a time and
 * yields to the event loop between letters so the progress bar keeps painting
 * on a few hundred rows.
 */
export async function downloadZip(
  company: Company,
  letters: LetterData[],
  onProgress?: Progress,
  filename = 'confirmation-letters.zip',
) {
  const zip = new JSZip();
  const used = new Map<string, number>();

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const blob = await renderBlob(company, [letter]);

    // Two clients with the same name would otherwise overwrite each other.
    let name = safeFileName(letter.client_name);
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);
    if (seen > 0) name = safeFileName(letter.client_name, ` (${seen + 1})`);

    zip.file(name, blob);
    onProgress?.(i + 1, letters.length);
    await new Promise((r) => setTimeout(r, 0));
  }

  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerDownload(out, filename);
}
