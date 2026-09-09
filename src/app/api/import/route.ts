import { guarded } from '@/lib/guard';
import { createBatch, insertLetters, upsertClientByName, type LetterInput } from '@/lib/repo';
import { AMOUNT_FIELDS } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IncomingRow = {
  name: string;
  address?: string;
  pan_number?: string;
  phone?: string;
  amounts: Record<string, number>;
};

type Body = {
  label?: string;
  fiscal_year: string;
  subject?: string;
  letter_date: string;
  opening_date_bs?: string;
  closing_date_bs?: string;
  source_file?: string;
  rows: IncomingRow[];
};

/**
 * Saves an imported set: one batch, a client per distinct name, and one letter
 * per row. Only called when the user ticks "save to database" - generating PDFs
 * alone never writes anything.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  return guarded(async () => {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) throw new Error('There are no rows to save.');
    if (!body.fiscal_year?.trim()) throw new Error('A fiscal year is required.');

    const batch = await createBatch({
      label: body.label,
      fiscal_year: body.fiscal_year,
      source_file: body.source_file,
    });

    // Resolve clients first. Names repeated within one file map to the same
    // client row, so the per-name cache also avoids redundant round trips.
    const idByName = new Map<string, number>();
    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      if (idByName.has(key)) continue;
      const client = await upsertClientByName({
        name: r.name,
        address: r.address,
        pan_number: r.pan_number,
        phone: r.phone,
      });
      idByName.set(key, client.id);
    }

    const letters: LetterInput[] = rows.map((r) => {
      const amounts = Object.fromEntries(
        AMOUNT_FIELDS.map((f) => [f, Number(r.amounts?.[f] ?? 0) || 0]),
      );
      return {
        client_id: idByName.get(r.name.trim().toLowerCase())!,
        batch_id: batch.id,
        fiscal_year: body.fiscal_year,
        subject: body.subject ?? '',
        letter_date: body.letter_date,
        opening_date_bs: body.opening_date_bs ?? '',
        closing_date_bs: body.closing_date_bs ?? '',
        ...amounts,
      } as LetterInput;
    });

    const ids = await insertLetters(letters);
    return { batch_id: batch.id, clients: idByName.size, letters: ids.length };
  });
}
