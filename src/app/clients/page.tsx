import { requirePage } from '@/lib/guard';
import Shell from '@/components/Shell';
import ClientsTable from './ClientsTable';

export default async function ClientsPage() {
  await requirePage();
  return (
    <Shell>
      <ClientsTable />
    </Shell>
  );
}
