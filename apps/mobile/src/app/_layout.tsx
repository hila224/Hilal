import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { LoadingView } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { syncMedicationReminders } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { loading, session, profile, patient } = useAuth();
  const signedIn = !!session;
  const isPatient = profile?.role === 'patient' && !!patient;
  const consented = !!patient?.consentement_rgpd_at;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Replanifie les rappels à chaque connexion / déconnexion.
  useEffect(() => {
    if (!loading) syncMedicationReminders().catch(() => {});
  }, [loading, session?.user.id]);

  if (loading) return <LoadingView />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="connexion" />
        <Stack.Screen
          name="inscription"
          options={{ headerShown: true, title: 'Créer un compte', headerBackTitle: 'Retour' }}
        />
        <Stack.Screen
          name="mot-de-passe-oublie"
          options={{ headerShown: true, title: 'Mot de passe oublié', headerBackTitle: 'Retour' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !isPatient}>
        <Stack.Screen name="reserve-aux-patients" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && isPatient && !consented}>
        <Stack.Screen name="consentement" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && isPatient && consented}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
