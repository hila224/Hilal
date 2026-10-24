import AppTabs from '@/components/app-tabs';
import { DOCTOR_TABS } from '@/components/tabs-config';

export default function DoctorLayout() {
  return <AppTabs tabs={DOCTOR_TABS} />;
}
