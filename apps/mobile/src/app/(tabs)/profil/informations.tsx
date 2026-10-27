import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Chips, Notice, Screen, Section, TextField } from '@/components/ui';
import { updateMyDetails } from '@/lib/api-record';
import { useAuth } from '@/lib/auth-context';
import { toInputDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { errorMessage } from '@/lib/supabase';
import type { MaritalStatus, Patient, Sex } from '@/lib/types';
import { optionalText, phoneSchema, readDate } from '@/lib/validation';

const SEXES: Sex[] = ['F', 'M', 'X'];
const MARITAL: MaritalStatus[] = ['celibataire', 'marie', 'divorce', 'veuf'];

/** Identité administrative complète : naissance, adresse, personne à prévenir, assurance. */
export default function MyInformationScreen() {
  const { patient } = useAuth();
  // Le formulaire démarre avec les valeurs enregistrées.
  return <Screen edgeTop={false}>{patient ? <InformationForm key={patient.id} patient={patient} /> : null}</Screen>;
}

function InformationForm({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const { reload } = useAuth();
  const [values, setValues] = useState(() => ({
    birthDate: toInputDate(patient.date_naissance),
    city: patient.ville ?? '',
    commune: patient.commune ?? '',
    street: patient.adresse ?? '',
    profession: patient.profession ?? '',
    emergencyName: patient.contact_urgence_nom ?? '',
    emergencyRelation: patient.contact_urgence_lien ?? '',
    emergencyPhone: formatPhone(patient.contact_urgence_tel),
    insuranceName: patient.assurance ?? '',
    insuranceNumber: patient.numero_assurance ?? '',
  }));
  const [sex, setSex] = useState<Sex | ''>(patient.sexe ?? '');
  const [marital, setMarital] = useState<MaritalStatus | ''>(patient.situation_familiale ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChangeText: (text: string) => setValues((current) => ({ ...current, [key]: text })),
    error: errors[key],
  });

  async function save() {
    const birthDate = readDate(values.birthDate, { notFuture: true });
    const phone = phoneSchema().safeParse(values.emergencyPhone);
    const nextErrors = {
      birthDate: birthDate.error,
      emergencyPhone: phone.success ? undefined : t('validation.emergencyPhone'),
      city: values.city.trim() && values.city.trim().length < 2 ? t('validation.required') : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !phone.success) return;

    setSaving(true);
    setMessage(null);
    try {
      await updateMyDetails({
        date_naissance: birthDate.value,
        sexe: sex || null,
        ville: optionalText(values.city),
        commune: optionalText(values.commune),
        adresse: optionalText(values.street),
        profession: optionalText(values.profession),
        situation_familiale: marital || null,
        contact_urgence_nom: optionalText(values.emergencyName),
        contact_urgence_lien: optionalText(values.emergencyRelation),
        contact_urgence_tel: phone.data,
        assurance: optionalText(values.insuranceName),
        numero_assurance: optionalText(values.insuranceNumber),
      });
      await reload();
      router.back();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ThemedText themeColor="textSecondary">{t('myInfo.intro')}</ThemedText>

      <Section title={t('profile.identity')}>
        <TextField
          label={t('myInfo.birthDate')}
          placeholder={t('entry.datePlaceholder')}
          keyboardType="numbers-and-punctuation"
          {...field('birthDate')}
        />
        <ThemedText type="smallBold">{t('myInfo.sex')}</ThemedText>
        <Chips options={SEXES.map((value) => ({ value, label: t(`myInfo.sexValue.${value}`) }))} value={sex} onChange={setSex} />
        <TextField label={t('myInfo.profession')} {...field('profession')} />
        <ThemedText type="smallBold">{t('myInfo.maritalStatus')}</ThemedText>
        <Chips options={MARITAL.map((value) => ({ value, label: t(`myInfo.marital.${value}`) }))} value={marital} onChange={setMarital} />
      </Section>

      <Section title={t('myInfo.address')}>
        <TextField label={t('myInfo.city')} autoComplete="address-line2" {...field('city')} />
        <TextField label={t('myInfo.commune')} {...field('commune')} />
        <TextField label={t('myInfo.street')} autoComplete="street-address" {...field('street')} />
      </Section>

      <Section title={t('myInfo.emergency')}>
        <TextField label={t('myInfo.emergencyName')} {...field('emergencyName')} />
        <TextField label={t('myInfo.emergencyRelation')} {...field('emergencyRelation')} />
        <TextField
          label={t('myInfo.emergencyPhone')}
          keyboardType="phone-pad"
          placeholder={t('profile.phonePlaceholder')}
          {...field('emergencyPhone')}
        />
      </Section>

      <Section title={t('myInfo.insurance')}>
        <TextField label={t('myInfo.insuranceName')} {...field('insuranceName')} />
        <TextField label={t('myInfo.insuranceNumber')} {...field('insuranceNumber')} />
      </Section>

      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button label={t('myInfo.save')} onPress={save} loading={saving} />
    </>
  );
}
