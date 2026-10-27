import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function DoctorPatientsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ title: t('doctorSpace.record') }} />
      <Stack.Screen name="[id]/consultation" options={{ title: t('consultation.newTitle') }} />
      <Stack.Screen name="[id]/ordonnance" options={{ title: t('prescriptionForm.title') }} />
      <Stack.Screen name="[id]/ajouter" options={{ title: t('record.add') }} />
      <Stack.Screen name="[id]/document" options={{ title: t('documentForm.title') }} />
      <Stack.Screen name="[id]/profil-medical" options={{ title: t('medicalProfileForm.title') }} />
      <Stack.Screen name="[id]/compte-rendu" options={{ title: t('consultation.title') }} />
    </Stack>
  );
}
