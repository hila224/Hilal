import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, MEDICAL_DISCLAIMER, Notice, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorMessage, supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      setError('Renseignez votre e-mail et votre mot de passe.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    // En cas de succès, la navigation change d'elle-même (voir app/_layout.tsx).
    if (authError) setError(errorMessage(authError));
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText type="title">Hilal Santé</ThemedText>
        <ThemedText themeColor="textSecondary">
          Vos rendez-vous, votre dossier médical et vos traitements au même endroit.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="vous@exemple.fr"
        />
        <TextField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={signIn}
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button label="Se connecter" onPress={signIn} loading={submitting} />
        <Link href="/mot-de-passe-oublie" style={styles.link}>
          <ThemedText type="link">Mot de passe oublié ?</ThemedText>
        </Link>
      </View>

      <View style={styles.footer}>
        <ThemedText themeColor="textSecondary">Pas encore de compte ?</ThemedText>
        <Button label="Créer un compte" variant="secondary" onPress={() => router.push('/inscription')} />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
        {MEDICAL_DISCLAIMER}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
    marginTop: Spacing.five,
  },
  form: {
    gap: Spacing.three,
  },
  link: {
    alignSelf: 'center',
  },
  footer: {
    gap: Spacing.two,
  },
  disclaimer: {
    textAlign: 'center',
  },
});
