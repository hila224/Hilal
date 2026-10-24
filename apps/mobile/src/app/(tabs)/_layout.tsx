import AppTabs from '@/components/app-tabs';
import { PATIENT_TABS } from '@/components/tabs-config';

export default function TabsLayout() {
  return <AppTabs tabs={PATIENT_TABS} />;
}
