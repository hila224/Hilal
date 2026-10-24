import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, Notice, Screen, Section, TextField } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';
import { fieldErrors, signUpSchema } from '@/lib/validation';

export default function SignUpScreen() {
  const [values, setValues] = useState({ prenom: '', nom: '', email: '', password: '', confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof values) => (text: string) => setValues((v) => ({ ...v, [key]: text }));

  async function signUp() {
    const { data, errors: invalid } = fieldErrors(signUpSchema, values);
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
        <Notice tone="success">
          Compte créé. Ouvrez le lien reçu à {values.email} pour confirmer votre adresse, puis
          connectez-vous.
        </Notice>
      </Screen>
    );
  }

  return (
    <Screen edgeTop={false}>
      <ThemedText themeColor="textSecondary">
        Créez votre espace patient pour prendre rendez-vous et suivre vos traitements.
      </ThemedText>

      <Section title="Identité">
        <TextField label="Prénom" value={values.prenom} onChangeText={set('prenom')} autoComplete="given-name" error={errors.prenom} />
        <TextField label="Nom" value={values.nom} onChangeText={set('nom')} autoComplete="family-name" error={errors.nom} />
      </Section>

      <Section title="Connexion">
        <TextField
          label="E-mail"
          value={values.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
        />
        <TextField
          label="Mot de passe"
          value={values.password}
          onChangeText={set('password')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
        />
        <ThemedText type="small" themeColor="textSecondary">
          10 caractères minimum, avec au moins une lettre et un chiffre.
        </ThemedText>
        <TextField
          label="Confirmer le mot de passe"
          value={values.confirmation}
          onChangeText={set('confirmation')}
          secureTextEntry
          autoComplete="new-password"
          error={errors.confirmation}
        />
      </Section>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button label="Créer mon compte" onPress={signUp} loading={submitting} />
    </Screen>
  );
}
