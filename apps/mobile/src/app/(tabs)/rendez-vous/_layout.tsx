import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function AppointmentsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="nouveau" options={{ title: t('booking.title') }} />
    </Stack>
  );
}
