import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function RecordLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="informations" options={{ title: t('myInfo.title') }} />
      <Stack.Screen name="profil-medical" options={{ title: t('medicalProfileForm.title') }} />
      <Stack.Screen name="ajouter" options={{ title: t('record.add') }} />
      <Stack.Screen name="document" options={{ title: t('documentForm.title') }} />
      <Stack.Screen name="compte-rendu" options={{ title: t('consultation.title') }} />
    </Stack>
  );
}
