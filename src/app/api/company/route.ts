import { guarded } from '@/lib/guard';
import { getCompany, saveCompany } from '@/lib/repo';

export const runtime = 'nodejs';

export async function GET() {
  return guarded(() => getCompany());
}

export async function PUT(req: Request) {
  return guarded(async () => saveCompany(await req.json()));
}
