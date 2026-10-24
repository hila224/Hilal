import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import type { TabConfig } from '@/components/tabs-config';
import { useTheme } from '@/hooks/use-theme';

/** Barre d'onglets native (iOS / Android) d'un espace : patient, établissement, médecin… */
export default function AppTabs({ tabs }: { tabs: readonly TabConfig[] }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={theme.backgroundElement}
      indicatorColor={theme.backgroundSelected}
      tintColor={theme.primary}
      labelStyle={{ selected: { color: theme.primary } }}>
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
