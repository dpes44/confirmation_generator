import { requirePage } from '@/lib/guard';
import Shell from '@/components/Shell';
import LettersTable from './LettersTable';

export default async function LettersPage() {
  await requirePage();
  return (
    <Shell>
      <LettersTable />
    </Shell>
  );
}
