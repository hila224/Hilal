// Consultation rédigée par le médecin : observation clinique et constantes.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Chips, Notice, Section, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { saveConsultation } from '@/lib/api-record';
import { errorMessage } from '@/lib/supabase';
import type { Consultation, ConsultationFields, Vitals } from '@/lib/types';
import { optionalText, readNumber } from '@/lib/validation';

/** Constantes : clé, libellé, bornes acceptées par la base, entier ou décimal. */
const VITALS = [
  { key: 'tension_sys', label: 'vitals.systolic', min: 40, max: 300, integer: true },
  { key: 'tension_dia', label: 'vitals.diastolic', min: 20, max: 200, integer: true },
  { key: 'pouls', label: 'vitals.pulse', min: 20, max: 250, integer: true },
  { key: 'temperature', label: 'vitals.temperature', min: 30, max: 45, integer: false },
  { key: 'frequence_respiratoire', label: 'vitals.respiratoryRate', min: 4, max: 80, integer: true },
  { key: 'saturation', label: 'vitals.saturation', min: 50, max: 100, integer: true },
  { key: 'glycemie', label: 'vitals.glycemia', min: 0.2, max: 6, integer: false },
  { key: 'poids_kg', label: 'vitals.weight', min: 1, max: 400, integer: false },
  { key: 'taille_cm', label: 'vitals.height', min: 30, max: 260, integer: true },
] as const satisfies readonly { key: keyof Vitals; label: string; min: number; max: number; integer: boolean }[];

type TextKey = 'motif' | 'histoire' | 'examen' | 'diagnostic' | 'conduite';
const TEXTS = [
  { key: 'motif', label: 'consultation.motif', multiline: false },
  { key: 'histoire', label: 'consultation.history', multiline: true },
  { key: 'examen', label: 'consultation.exam', multiline: true },
  { key: 'diagnostic', label: 'consultation.diagnosis', multiline: false },
  { key: 'conduite', label: 'consultation.plan', multiline: true },
] as const satisfies readonly { key: TextKey; label: string; multiline: boolean }[];

export type ConsultationContext = {
  /** Établissements où exerce le médecin (choix pour une nouvelle consultation). */
  hospitals: { id: string; nom: string }[];
  /** Rendez-vous d'origine, s'il y en a un. */
  appointment: { id: string; hospital_id: string; motif: string | null } | null;
};

export function ConsultationForm({ patientId, existing, context, onDone }: {
  patientId: string;
  existing: Consultation | null;
  context: ConsultationContext;
  /** `prescribe` : le médecin veut enchaîner sur l'ordonnance. */
  onDone: (consultationId: string, prescribe: boolean) => void;
}) {
  const { t } = useTranslation();
  const [texts, setTexts] = useState<Record<TextKey, string>>(() => ({
    motif: existing?.motif ?? context.appointment?.motif ?? '',
    histoire: existing?.histoire ?? '',
    examen: existing?.examen ?? '',
    diagnostic: existing?.diagnostic ?? '',
    conduite: existing?.conduite ?? '',
  }));
  const [vitals, setVitals] = useState<Record<keyof Vitals, string>>(() => {
    const initial = {} as Record<keyof Vitals, string>;
    for (const { key } of VITALS) initial[key] = existing?.[key] != null ? String(existing[key]) : '';
    return initial;
  });
  const [hospitalId, setHospitalId] = useState<string>(
    existing?.hospital_id ?? context.appointment?.hospital_id ?? context.hospitals[0]?.id ?? ''
  );
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState<'save' | 'prescribe' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(prescribe: boolean) {
    const nextErrors: Record<string, string | undefined> = {};
    if (texts.motif.trim().length < 2) nextErrors.motif = t('consultation.motifRequired');
    const values = {} as Vitals;
    for (const field of VITALS) {
      const read = readNumber(vitals[field.key], field.min, field.max, { integer: field.integer });
      values[field.key] = read.value;
      if (read.error) nextErrors[field.key] = read.error;
    }
    if (values.tension_sys != null && values.tension_dia != null && values.tension_sys <= values.tension_dia) {
      nextErrors.tension_sys = t('validation.bloodPressure');
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const fields: ConsultationFields = {
      ...values,
      motif: texts.motif.trim(),
      histoire: optionalText(texts.histoire),
      examen: optionalText(texts.examen),
      diagnostic: optionalText(texts.diagnostic),
      conduite: optionalText(texts.conduite),
    };
    setSaving(prescribe ? 'prescribe' : 'save');
    setMessage(null);
    try {
      const id = await saveConsultation(
        patientId,
        { ...fields, hospital_id: hospitalId || null, appointment_id: existing ? existing.appointment_id : (context.appointment?.id ?? null) },
        existing?.id
      );
      onDone(id, prescribe);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      {!existing && !context.appointment && context.hospitals.length > 1 ? (
        <Section title={t('consultation.hospital')}>
          <Chips options={context.hospitals.map((h) => ({ value: h.id, label: h.nom }))} value={hospitalId} onChange={setHospitalId} />
        </Section>
      ) : null}

      <Section title={t('consultation.observation')}>
        {TEXTS.map((field) => (
          <TextField
            key={field.key}
            label={t(field.label)}
            value={texts[field.key]}
            onChangeText={(text) => setTexts((current) => ({ ...current, [field.key]: text }))}
            multiline={field.multiline}
            style={field.multiline ? styles.multiline : undefined}
            error={errors[field.key]}
          />
        ))}
      </Section>

      <Section title={t('vitals.title')}>
        <View style={styles.grid}>
          {VITALS.map((field) => (
            <View key={field.key} style={styles.cell}>
              <TextField
                label={t(field.label)}
                value={vitals[field.key]}
                onChangeText={(text) => setVitals((current) => ({ ...current, [field.key]: text }))}
                keyboardType={field.integer ? 'number-pad' : 'decimal-pad'}
                error={errors[field.key]}
              />
            </View>
          ))}
        </View>
      </Section>

      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button label={t('consultation.saveAndPrescribe')} onPress={() => save(true)} loading={saving === 'prescribe'} disabled={!!saving} />
      <Button variant="secondary" label={t('consultation.save')} onPress={() => save(false)} loading={saving === 'save'} disabled={!!saving} />
    </>
  );
}

const styles = StyleSheet.create({
  multiline: {
    minHeight: 96,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    flexGrow: 1,
    flexBasis: 150,
  },
});
