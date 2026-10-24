import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function send() {
    if (!email.trim()) {
      setError(t('auth.emailRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setSubmitting(false);
    if (authError) setError(errorMessage(authError));
    else setSent(true);
  }

  return (
    <Screen edgeTop={false}>
      <ThemedText themeColor="textSecondary">{t('auth.forgotIntro')}</ThemedText>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {sent ? (
        // Même message que le compte existe ou non, pour ne pas révéler qui est inscrit.
        <Notice tone="success">{t('auth.linkSent')}</Notice>
      ) : (
        <Button label={t('auth.sendLink')} onPress={send} loading={submitting} />
      )}
    </Screen>
  );
}
