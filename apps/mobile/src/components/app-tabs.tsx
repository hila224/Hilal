import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={theme.backgroundElement}
      indicatorColor={theme.backgroundSelected}
      tintColor={theme.primary}
      labelStyle={{ selected: { color: theme.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rendez-vous">
        <NativeTabs.Trigger.Label>{t('tabs.appointments')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="traitements">
        <NativeTabs.Trigger.Label>{t('tabs.treatments')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="pills.fill" md="medication" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="dossier">
        <NativeTabs.Trigger.Label>{t('tabs.record')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="folder.fill" md="folder_shared" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
