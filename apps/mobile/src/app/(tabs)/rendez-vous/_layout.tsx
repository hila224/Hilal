import { Stack } from 'expo-router';

export default function AppointmentsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="nouveau" options={{ title: 'Nouveau rendez-vous', headerBackTitle: 'Retour' }} />
    </Stack>
  );
}
