import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Chips, Notice, Screen, Section, TextField } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';
import type { HospitalType } from '@/lib/types';
import { fieldErrors, hospitalSignUpSchema } from '@/lib/validation';

const TYPES: HospitalType[] = ['hopital_public', 'clinique_privee', 'centre_sante', 'cabinet'];

/** Un établissement ouvre son compte ; il reste « en attente » jusqu'à la validation par la plateforme. */
export default function HospitalSignUpScreen() {
  const { t } = useTranslation();
  const [values, setValues] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    confirmation: '',
    etablissement: '',
    type: 'hopital_public' as HospitalType,
    ville: 'Conakry',
    commune: '',
    telephone: '',
    agrement: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof values) => (text: string) => setValues((v) => ({ ...v, [key]: text }));

  async function submit() {
    const { data, errors: invalid } = fieldErrors(hospitalSignUpSchema(), values);
    setErrors(invalid);
    if (!data) return;

    setSubmitting(true);
    setError(null);
    const { data: result, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          prenom: data.prenom,
          nom: data.nom,
          type_compte: 'etablissement',
          etablissement: {
            nom: data.etablissement,
            type: data.type,
            ville: data.ville,
            commune: data.commune,
            telephone: data.telephone,
            numero_agrement: data.agrement,
          },
        },
      },
    });
    setSubmitting(false);
    if (authError) setError(errorMessage(authError));
    else if (!result.session) setCheckEmail(true);
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
      <ThemedText themeColor="textSecondary">{t('hospitalSignUp.intro')}</ThemedText>

      <Section title={t('hospitalSignUp.hospital')}>
        <TextField label={t('hospital.name')} value={values.etablissement} onChangeText={set('etablissement')} error={errors.etablissement} />
        <ThemedText type="smallBold">{t('hospital.typeLabel')}</ThemedText>
        <Chips
          options={TYPES.map((type) => ({ value: type, label: t(`hospital.type.${type}`) }))}
          value={values.type}
          onChange={(type) => setValues((v) => ({ ...v, type }))}
        />
        <TextField label={t('hospital.city')} value={values.ville} onChangeText={set('ville')} error={errors.ville} />
        <TextField label={t('hospital.district')} value={values.commune} onChangeText={set('commune')} />
        <TextField
          label={t('hospital.phone')}
          value={values.telephone}
          onChangeText={set('telephone')}
          keyboardType="phone-pad"
          placeholder="300 00 00 00"
          error={errors.telephone}
        />
        <TextField
          label={t('hospital.licence')}
          value={values.agrement}
          onChangeText={set('agrement')}
          autoCapitalize="characters"
          error={errors.agrement}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('hospitalSignUp.licenceHelp')}
        </ThemedText>
      </Section>

      <Section title={t('hospitalSignUp.manager')}>
        <TextField label={t('auth.firstName')} value={values.prenom} onChangeText={set('prenom')} autoComplete="given-name" error={errors.prenom} />
        <TextField label={t('auth.lastName')} value={values.nom} onChangeText={set('nom')} autoComplete="family-name" error={errors.nom} />
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
      <Button label={t('hospitalSignUp.submit')} onPress={submit} loading={submitting} />
    </Screen>
  );
}
