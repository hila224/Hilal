import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function HospitalDoctorsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="ajouter" options={{ title: t('hospitalDoctors.addTitle') }} />
      <Stack.Screen name="creneaux" options={{ title: t('hospitalDoctors.slotsTitle') }} />
    </Stack>
  );
}
