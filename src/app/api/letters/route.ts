import { guarded } from '@/lib/guard';
import { insertLetters, listLetters, deleteLetters, type LetterInput } from '@/lib/repo';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  return guarded(() => listLetters({
    batchId: p.get('batch') ? Number(p.get('batch')) : undefined,
    fiscalYear: p.get('fy') ?? undefined,
    search: p.get('q') ?? undefined,
  }));
}

export async function POST(req: Request) {
  const body = await req.json();
  const rows: LetterInput[] = Array.isArray(body) ? body : [body];
  return guarded(async () => ({ ids: await insertLetters(rows) }));
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ids: number[] = (body?.ids ?? []).map(Number).filter(Number.isFinite);
  return guarded(async () => {
    await deleteLetters(ids);
    return { deleted: ids.length };
  });
}
