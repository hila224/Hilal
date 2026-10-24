import AppTabs from '@/components/app-tabs';
import { HOSPITAL_TABS } from '@/components/tabs-config';
import { HospitalProvider } from '@/lib/hospital-context';

export default function HospitalLayout() {
  return (
    <HospitalProvider>
      <AppTabs tabs={HOSPITAL_TABS} />
    </HospitalProvider>
  );
}
