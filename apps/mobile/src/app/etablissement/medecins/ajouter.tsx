import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Chips, EmptyState, Notice, Screen, Section, TextField } from '@/components/ui';
import { addDoctor, fetchHospitalCatalog } from '@/lib/api-pro';
import { useHospital, useHospitalData } from '@/lib/hospital-context';
import { errorMessage } from '@/lib/supabase';
import { fieldErrors, newDoctorSchema } from '@/lib/validation';

/** L'établissement enregistre un médecin et se porte garant de son inscription à l'Ordre. */
export default function AddDoctorScreen() {
  const { t } = useTranslation();
  const { hospital } = useHospital();
  const catalog = useHospitalData((h) => fetchHospitalCatalog(h.id));
  const services = catalog.data?.services.filter((s) => s.actif) ?? [];

  const [values, setValues] = useState({ prenom: '', nom: '', email: '', specialite: '', numero_ordre: '', service_id: '' });
  const [guarantee, setGuarantee] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'affilie' | 'invite' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof values) => (text: string) => setValues((v) => ({ ...v, [key]: text }));

  async function submit() {
    const { data, errors: invalid } = fieldErrors(newDoctorSchema(), values);
    setErrors(invalid);
    if (!data || !hospital) return;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await addDoctor(hospital.id, data));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Screen edgeTop={false}>
        <Notice tone="success">
          {result === 'affilie'
            ? t('hospitalDoctors.added', { email: values.email })
            : t('hospitalDoctors.invited', { email: values.email })}
        </Notice>
        <Button label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edgeTop={false}>
      <ThemedText themeColor="textSecondary">{t('hospitalDoctors.addIntro')}</ThemedText>
      <Section title={t('hospitalDoctors.identity')}>
        <TextField label={t('auth.firstName')} value={values.prenom} onChangeText={set('prenom')} error={errors.prenom} />
        <TextField label={t('auth.lastName')} value={values.nom} onChangeText={set('nom')} error={errors.nom} />
        <TextField
          label={t('auth.email')}
          value={values.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          error={errors.email}
        />
        <TextField label={t('hospitalDoctors.specialty')} value={values.specialite} onChangeText={set('specialite')} error={errors.specialite} />
        <TextField
          label={t('hospitalDoctors.orderNumber')}
          value={values.numero_ordre}
          onChangeText={set('numero_ordre')}
          autoCapitalize="characters"
          error={errors.numero_ordre}
        />
      </Section>

      <Section title={t('hospitalDoctors.service')}>
        <AsyncContent loading={catalog.loading} error={catalog.error} retry={catalog.refresh}>
          {services.length ? (
            <Chips
              options={services.map((s) => ({ value: s.id, label: s.nom }))}
              value={values.service_id}
              onChange={(service_id) => setValues((v) => ({ ...v, service_id }))}
            />
          ) : (
            <EmptyState text={t('hospitalDoctors.noService')} />
          )}
        </AsyncContent>
        {errors.service_id ? (
          <ThemedText type="small" themeColor="danger">
            {errors.service_id}
          </ThemedText>
        ) : null}
      </Section>

      <Chips
        options={[{ value: 'oui', label: t('hospitalDoctors.guarantee', { hospital: hospital?.nom ?? '' }) }]}
        value={guarantee ? 'oui' : ''}
        onChange={() => setGuarantee((g) => !g)}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button label={t('hospitalDoctors.submit')} onPress={submit} loading={submitting} disabled={!guarantee} />
    </Screen>
  );
}
