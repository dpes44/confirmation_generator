import { requirePage } from '@/lib/guard';
import Shell from '@/components/Shell';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  await requirePage();
  return (
    <Shell>
      <SettingsForm />
    </Shell>
  );
}
