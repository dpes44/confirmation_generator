import { guarded } from '@/lib/guard';
import { deleteClient, updateClient } from '@/lib/repo';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  return guarded(() => updateClient(Number(id), body));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return guarded(async () => {
    await deleteClient(Number(id));
    return { ok: true };
  });
}
