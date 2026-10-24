import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Notice, Screen, Section, TextField } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';
import { fieldErrors, signUpSchema } from '@/lib/validation';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [values, setValues] = useState({ prenom: '', nom: '', email: '', password: '', confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof values) => (text: string) => setValues((v) => ({ ...v, [key]: text }));

  async function signUp() {
    const { data, errors: invalid } = fieldErrors(signUpSchema(), values);
    setErrors(invalid);
    if (!data) return;

    setSubmitting(true);
    setError(null);
    const { data: result, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      // Seuls le prénom et le nom sont lus côté serveur ; le rôle est toujours « patient ».
      options: { data: { prenom: data.prenom, nom: data.nom } },
    });
    setSubmitting(false);
    if (authError) {
      setError(errorMessage(authError));
    } else if (!result.session) {
      // Projet configuré avec confirmation de l'e-mail.
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <Screen edgeTop={false}>
        <Notice tone="success">{t('auth.checkEmail', { email: values.email })}</Notice>
      </Screen>
    );
  }

  return (
    <Screen edgeTop={false}>
      <ThemedText themeColor="textSecondary">{t('auth.signUpIntro')}</ThemedText>

      <Section title={t('auth.identity')}>
        <TextField label={t('auth.firstName')} value={values.prenom} onChangeText={set('prenom')} autoComplete="given-name" error={errors.prenom} />
        <TextField label={t('auth.lastName')} value={values.nom} onChangeText={set('nom')} autoComplete="family-name" error={errors.nom} />
      </Section>

      <Section title={t('auth.connection')}>
        <TextField
          label={t('auth.email')}
          value={values.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
        />
        <TextField
          label={t('auth.password')}
          value={values.password}
          onChangeText={set('password')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('auth.passwordRules')}
        </ThemedText>
        <TextField
          label={t('auth.confirmPassword')}
          value={values.confirmation}
          onChangeText={set('confirmation')}
          secureTextEntry
          autoComplete="new-password"
          error={errors.confirmation}
        />
      </Section>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button label={t('auth.createMyAccount')} onPress={signUp} loading={submitting} />
    </Screen>
  );
}
