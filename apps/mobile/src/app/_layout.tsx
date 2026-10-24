import '@/i18n';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

import { LoadingView } from '@/components/ui';
import { updatePatientPreferences } from '@/lib/api';
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
  const { t, i18n } = useTranslation();
  const { loading, session, profile, patient } = useAuth();
  const signedIn = !!session;
  const isPatient = profile?.role === 'patient' && !!patient;
  const consented = !!patient?.consentement_rgpd_at;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Replanifie les rappels à chaque connexion / déconnexion et changement de langue.
  useEffect(() => {
    if (!loading) syncMedicationReminders().catch(() => {});
  }, [loading, session?.user.id, i18n.language]);

  // La langue choisie dans l'app est aussi celle des SMS : on la recopie côté serveur.
  useEffect(() => {
    if (patient && patient.langue !== i18n.language) {
      updatePatientPreferences({ langue: i18n.language }).catch(() => {});
    }
  }, [patient, i18n.language]);

  if (loading) return <LoadingView />;

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: t('common.back') }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="connexion" />
        <Stack.Screen name="inscription" options={{ headerShown: true, title: t('auth.createAccount') }} />
        <Stack.Screen name="mot-de-passe-oublie" options={{ headerShown: true, title: t('auth.forgotTitle') }} />
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
