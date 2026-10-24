import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function send() {
    if (!email.trim()) {
      setError('Indiquez votre adresse e-mail.');
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
      <ThemedText themeColor="textSecondary">
        Nous vous enverrons un lien pour choisir un nouveau mot de passe.
      </ThemedText>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {sent ? (
        // Même message que le compte existe ou non, pour ne pas révéler qui est inscrit.
        <Notice tone="success">Si un compte existe pour cette adresse, un e-mail vient d’être envoyé.</Notice>
      ) : (
        <Button label="Envoyer le lien" onPress={send} loading={submitting} />
      )}
    </Screen>
  );
}
