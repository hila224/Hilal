// Ordonnance rédigée par le médecin. Le plan de prise du patient (rappels, SMS)
// est généré par la base dès la validation.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, MultiChips, Notice, Section, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { createPrescription, type PrescriptionLine } from '@/lib/api-record';
import { matchingAllergy } from '@/lib/allergy-check';
import { addDays, today } from '@/lib/dates';
import { errorMessage } from '@/lib/supabase';
import type { Allergy } from '@/lib/types';
import { optionalText, readNumber } from '@/lib/validation';

const ROUTES = ['orale', 'injectable', 'cutanee', 'autre'] as const;
type Route = (typeof ROUTES)[number];
/** Voie enregistrée sur l'ordonnance (en français, comme les ordonnances papier). */
const ROUTE_TEXT: Record<Route, string | null> = { orale: 'orale', injectable: 'injectable', cutanee: 'cutanée', autre: null };
const TIMES = ['06:00', '08:00', '12:00', '14:00', '18:00', '20:00', '22:00'];

type LineDraft = {
  key: number;
  medicine: string;
  dose: string;
  route: Route;
  times: string[];
  days: string;
  instructions: string;
};

const emptyLine = (key: number): LineDraft => ({ key, medicine: '', dose: '', route: 'orale', times: ['08:00'], days: '5', instructions: '' });

export type PrescriptionContext = {
  allergies: Pick<Allergy, 'substance' | 'severite'>[];
  pregnant: boolean;
  /** Établissements du médecin (sans consultation d'origine). */
  hospitals: { id: string; nom: string }[];
};

export function PrescriptionForm({ patientId, consultationId, context, onDone }: {
  patientId: string;
  consultationId: string | null;
  context: PrescriptionContext;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine(1)]);
  const [notes, setNotes] = useState('');
  const [hospitalId, setHospitalId] = useState(context.hospitals[0]?.id ?? '');
  const [allergyConfirmed, setAllergyConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = (key: number, changes: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));

  const conflicts = lines
    .map((line) => ({ line, allergy: line.medicine.trim().length >= 3 ? matchingAllergy(line.medicine, context.allergies) : undefined }))
    .filter((c) => c.allergy);

  async function submit() {
    const nextErrors: Record<string, string | undefined> = {};
    const start = today();
    const payload: PrescriptionLine[] = [];
    for (const line of lines) {
      const days = readNumber(line.days, 1, 365, { integer: true });
      if (line.medicine.trim().length < 2) nextErrors[`${line.key}.medicine`] = t('prescriptionForm.medicineRequired');
      if (!line.dose.trim()) nextErrors[`${line.key}.dose`] = t('prescriptionForm.doseRequired');
      if (!line.times.length) nextErrors[`${line.key}.times`] = t('prescriptionForm.timesRequired');
      if (days.error || days.value == null) nextErrors[`${line.key}.days`] = t('prescriptionForm.daysInvalid');
      payload.push({
        medicament: line.medicine.trim(),
        dosage: line.dose.trim(),
        voie: ROUTE_TEXT[line.route],
        horaires: [...line.times].sort(),
        date_debut: start,
        date_fin: addDays(start, (days.value ?? 1) - 1),
        instructions: optionalText(line.instructions),
      });
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || (conflicts.length && !allergyConfirmed)) return;

    setSaving(true);
    setMessage(null);
    try {
      await createPrescription(patientId, payload, {
        notes: optionalText(notes),
        consultationId,
        hospitalId: consultationId ? null : hospitalId || null,
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
      <Notice tone={context.allergies.length ? 'warning' : 'info'}>
        {context.allergies.length
          ? t('prescriptionForm.allergiesKnown', { list: context.allergies.map((a) => a.substance).join(', ') })
          : t('prescriptionForm.noAllergiesKnown')}
      </Notice>
      {context.pregnant ? <Notice tone="warning">{t('prescriptionForm.pregnancyWarning')}</Notice> : null}

      {!consultationId && context.hospitals.length > 1 ? (
        <Section title={t('consultation.hospital')}>
          <Chips options={context.hospitals.map((h) => ({ value: h.id, label: h.nom }))} value={hospitalId} onChange={setHospitalId} />
        </Section>
      ) : null}

      {lines.map((line, index) => (
        <Section key={line.key} title={t('prescriptionForm.line', { n: index + 1 })}>
          <Card>
            <TextField
              label={t('prescriptionForm.medicine')}
              value={line.medicine}
              onChangeText={(medicine) => update(line.key, { medicine })}
              placeholder={t('prescriptionForm.medicinePlaceholder')}
              error={errors[`${line.key}.medicine`]}
            />
            <TextField
              label={t('prescriptionForm.dose')}
              value={line.dose}
              onChangeText={(dose) => update(line.key, { dose })}
              placeholder={t('prescriptionForm.dosePlaceholder')}
              error={errors[`${line.key}.dose`]}
            />
            <ThemedText type="smallBold">{t('prescriptionForm.route')}</ThemedText>
            <Chips
              options={ROUTES.map((value) => ({ value, label: t(`prescriptionForm.routes.${value}`) }))}
              value={line.route}
              onChange={(route) => update(line.key, { route })}
            />
            <ThemedText type="smallBold">{t('prescriptionForm.times')}</ThemedText>
            <MultiChips options={TIMES.map((value) => ({ value, label: value }))} values={line.times} onChange={(times) => update(line.key, { times })} />
            {errors[`${line.key}.times`] ? (
              <ThemedText type="small" themeColor="danger">
                {errors[`${line.key}.times`]}
              </ThemedText>
            ) : null}
            <TextField
              label={t('prescriptionForm.days')}
              value={line.days}
              onChangeText={(days) => update(line.key, { days })}
              keyboardType="number-pad"
              error={errors[`${line.key}.days`]}
            />
            <TextField
              label={t('prescriptionForm.instructions')}
              value={line.instructions}
              onChangeText={(instructions) => update(line.key, { instructions })}
              placeholder={t('prescriptionForm.instructionsPlaceholder')}
            />
            {lines.length > 1 ? (
              <View style={styles.row}>
                <Button
                  compact
                  variant="secondary"
                  label={t('prescriptionForm.removeLine')}
                  onPress={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                />
              </View>
            ) : null}
          </Card>
        </Section>
      ))}

      <Button
        variant="secondary"
        label={t('prescriptionForm.addLine')}
        onPress={() => setLines((current) => [...current, emptyLine(Math.max(...current.map((l) => l.key)) + 1)])}
        disabled={lines.length >= 20}
      />
      <TextField label={t('prescriptionForm.notes')} value={notes} onChangeText={setNotes} multiline />

      {conflicts.map(({ line, allergy }) => (
        <Notice key={line.key} tone="danger">
          {t('prescriptionForm.allergyWarning', { medicine: line.medicine.trim(), substance: allergy!.substance })}
        </Notice>
      ))}
      {conflicts.length ? (
        <MultiChips
          options={[{ value: 'confirm', label: t('prescriptionForm.allergyConfirm') }]}
          values={allergyConfirmed ? ['confirm'] : []}
          onChange={(values) => setAllergyConfirmed(values.length > 0)}
        />
      ) : null}

      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button
        label={t('prescriptionForm.submit')}
        onPress={submit}
        loading={saving}
        disabled={conflicts.length > 0 && !allergyConfirmed}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
