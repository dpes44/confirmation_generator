import { guarded } from '@/lib/guard';
import { createClient, listClients } from '@/lib/repo';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const search = new URL(req.url).searchParams.get('q') ?? '';
  return guarded(() => listClients(search));
}

export async function POST(req: Request) {
  return guarded(async () => createClient(await req.json()));
}
