import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function DoctorPatientsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: t('doctorSpace.record') }} />
    </Stack>
  );
}
