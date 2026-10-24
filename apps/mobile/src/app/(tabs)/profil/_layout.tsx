import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="acces" options={{ title: 'Accès à mon dossier', headerBackTitle: 'Retour' }} />
    </Stack>
  );
}
