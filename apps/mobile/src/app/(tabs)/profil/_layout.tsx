import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function ProfileLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="informations" options={{ title: t('myInfo.title') }} />
      <Stack.Screen name="acces" options={{ title: t('access.title') }} />
      <Stack.Screen name="medecin-traitant" options={{ title: t('treatingDoctor.title') }} />
      <Stack.Screen name="messages" options={{ title: t('messages.title') }} />
    </Stack>
  );
}
