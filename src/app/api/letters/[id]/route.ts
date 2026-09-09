import { guarded } from '@/lib/guard';
import { deleteLetters, updateLetter, getLetters } from '@/lib/repo';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(async () => {
    const rows = await getLetters([Number(id)]);
    if (!rows.length) throw new Error('That letter no longer exists.');
    return rows[0];
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  return guarded(async () => {
    await updateLetter(Number(id), body);
    return (await getLetters([Number(id)]))[0];
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(async () => {
    await deleteLetters([Number(id)]);
    return { ok: true };
  });
}
