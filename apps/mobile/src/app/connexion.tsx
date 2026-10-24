import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LanguagePicker } from '@/components/language-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      setError(t('auth.missingCredentials'));
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
      <LanguagePicker />

      <View style={styles.hero}>
        <ThemedText type="title">{t('common.appName')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('auth.tagline')}</ThemedText>
      </View>

      <View style={styles.form}>
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder={t('auth.emailPlaceholder')}
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={signIn}
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button label={t('auth.signIn')} onPress={signIn} loading={submitting} />
        <Link href="/mot-de-passe-oublie" style={styles.link}>
          <ThemedText type="link">{t('auth.forgot')}</ThemedText>
        </Link>
      </View>

      <View style={styles.footer}>
        <ThemedText themeColor="textSecondary">{t('auth.noAccount')}</ThemedText>
        <Button label={t('auth.createAccount')} variant="secondary" onPress={() => router.push('/inscription')} />
        <Link href="/inscription-etablissement" style={styles.link}>
          <ThemedText type="link">{t('hospitalSignUp.link')}</ThemedText>
        </Link>
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
        {f.disclaimer()}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
    marginTop: Spacing.three,
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
