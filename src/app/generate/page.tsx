import { requirePage } from '@/lib/guard';
import Shell from '@/components/Shell';
import Generator from './Generator';

export default async function GeneratePage() {
  await requirePage();
  return (
    <Shell>
      <Generator />
    </Shell>
  );
}
