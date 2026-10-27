import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Chips, Notice, TextField } from '@/components/ui';
import { saveMedicalProfile, type MedicalProfileValues } from '@/lib/api-record';
import { errorMessage } from '@/lib/supabase';
import type { Alcohol, BloodGroup, Electrophoresis, Sex, Tobacco } from '@/lib/types';
import { readNumber } from '@/lib/validation';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ELECTROPHORESIS: Electrophoresis[] = ['AA', 'AS', 'SS', 'AC', 'SC'];
const TOBACCO: Tobacco[] = ['non', 'ancien', 'actuel'];
const ALCOHOL: Alcohol[] = ['non', 'occasionnel', 'regulier'];

/** Profil médical, prérempli. Le patient comme son médecin peuvent le compléter. */
export function MedicalProfileForm({ patientId, initial, sex, onDone }: {
  patientId: string;
  initial: MedicalProfileValues | null;
  sex: Sex | null | undefined;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>(initial?.groupe_sanguin ?? '');
  const [electro, setElectro] = useState<Electrophoresis | ''>(initial?.electrophorese ?? '');
  const [height, setHeight] = useState(initial?.taille_cm ? String(initial.taille_cm) : '');
  const [weight, setWeight] = useState(initial?.poids_kg ? String(initial.poids_kg) : '');
  const [tobacco, setTobacco] = useState<Tobacco | ''>(initial?.tabac ?? '');
  const [alcohol, setAlcohol] = useState<Alcohol | ''>(initial?.alcool ?? '');
  const [pregnancy, setPregnancy] = useState<'oui' | 'non' | ''>(
    initial?.grossesse == null ? '' : initial.grossesse ? 'oui' : 'non'
  );
  const [errors, setErrors] = useState<{ height?: string; weight?: string }>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const unknown = { value: '' as const, label: t('record.unknown') };

  async function save() {
    const heightValue = readNumber(height, 30, 260, { integer: true });
    const weightValue = readNumber(weight, 1, 400);
    setErrors({ height: heightValue.error, weight: weightValue.error });
    if (heightValue.error || weightValue.error) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveMedicalProfile(patientId, {
        groupe_sanguin: bloodGroup || null,
        electrophorese: electro || null,
        taille_cm: heightValue.value,
        poids_kg: weightValue.value,
        tabac: tobacco || null,
        alcool: alcohol || null,
        grossesse: sex === 'F' && pregnancy ? pregnancy === 'oui' : null,
      });
      onDone();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ThemedText themeColor="textSecondary">{t('medicalProfileForm.intro')}</ThemedText>
      <ThemedText type="smallBold">{t('record.bloodGroup')}</ThemedText>
      <Chips options={[unknown, ...BLOOD_GROUPS.map((value) => ({ value, label: value }))]} value={bloodGroup} onChange={setBloodGroup} />
      <ThemedText type="smallBold">{t('record.electrophoresis')}</ThemedText>
      <Chips
        options={[unknown, ...ELECTROPHORESIS.map((value) => ({ value, label: t(`record.electrophoresisValue.${value}`) }))]}
        value={electro}
        onChange={setElectro}
      />
      <TextField label={t('vitals.height')} value={height} onChangeText={setHeight} keyboardType="number-pad" error={errors.height} />
      <TextField label={t('vitals.weight')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" error={errors.weight} />
      <ThemedText type="smallBold">{t('record.tobacco')}</ThemedText>
      <Chips options={[unknown, ...TOBACCO.map((value) => ({ value, label: t(`record.tobaccoValue.${value}`) }))]} value={tobacco} onChange={setTobacco} />
      <ThemedText type="smallBold">{t('record.alcohol')}</ThemedText>
      <Chips options={[unknown, ...ALCOHOL.map((value) => ({ value, label: t(`record.alcoholValue.${value}`) }))]} value={alcohol} onChange={setAlcohol} />
      {sex === 'F' ? (
        <>
          <ThemedText type="smallBold">{t('record.pregnancy')}</ThemedText>
          <Chips
            options={[unknown, { value: 'oui' as const, label: t('common.yes') }, { value: 'non' as const, label: t('common.no') }]}
            value={pregnancy}
            onChange={setPregnancy}
          />
        </>
      ) : null}
      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button label={t('medicalProfileForm.save')} onPress={save} loading={saving} />
    </>
  );
}
