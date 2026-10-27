// Petits éléments communs au dossier vu par le patient et par le médecin.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card, InfoRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { bodyMassIndex } from '@/lib/dates';
import { useFormat } from '@/lib/format';
import type { Consultation, PatientRecord, RecordAuthor, Severity, Vitals } from '@/lib/types';

export const SEVERITY_TONE: Record<Severity, 'info' | 'warning' | 'danger'> = {
  faible: 'info',
  moderee: 'warning',
  severe: 'danger',
};

/** Lien d'action en tête de section (« + Ajouter », « Modifier »). */
export function SectionLink({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedText type="smallBold" themeColor="primary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** « Déclaré par le patient », « Ajouté par vous » ou « Ajouté par Dr X ». */
export function AuthorLine({ item, myId }: { item: Pick<RecordAuthor, 'created_by' | 'par_patient' | 'auteur'>; myId: string | undefined }) {
  const { t } = useTranslation();
  const f = useFormat();
  const text =
    item.created_by === myId
      ? t('record.byYou')
      : item.par_patient
        ? t('record.byPatient')
        : t('record.byDoctor', { name: f.doctorName(item.auteur) });
  return (
    <ThemedText type="small" themeColor={item.par_patient ? 'warning' : 'textSecondary'}>
      {text}
    </ThemedText>
  );
}

/** Informations à connaître avant tout soin : allergies, drépanocytose, grossesse, maladies et traitements en cours. */
export function AlertsCard({ record }: { record: PatientRecord }) {
  const { t } = useTranslation();
  const profile = record.profil_medical;
  const sickle = profile?.electrophorese && profile.electrophorese !== 'AA' ? profile.electrophorese : null;
  const ongoing = record.antecedents.filter((h) => h.actif);
  const treatments = record.traitements_habituels.filter((tr) => tr.actif);
  if (!record.allergies.length && !sickle && !profile?.grossesse && !ongoing.length && !treatments.length) return null;

  return (
    <Card>
      <ThemedText type="smallBold">{t('record.alerts')}</ThemedText>
      <View style={styles.badges}>
        {record.allergies.map((allergy) => (
          <Badge
            key={allergy.id}
            label={t('record.allergyTo', { substance: allergy.substance })}
            tone={allergy.severite ? SEVERITY_TONE[allergy.severite] : 'warning'}
          />
        ))}
        {sickle ? (
          <Badge label={`${t('record.electrophoresis')} : ${t(`record.electrophoresisValue.${sickle}`)}`} tone={sickle === 'AS' || sickle === 'AC' ? 'warning' : 'danger'} />
        ) : null}
        {profile?.grossesse ? <Badge label={t('record.pregnancy')} tone="info" /> : null}
        {ongoing.map((item) => (
          <Badge key={item.id} label={item.description} tone="warning" />
        ))}
        {treatments.map((item) => (
          <Badge key={item.id} label={item.medicament} tone="info" />
        ))}
      </View>
    </Card>
  );
}

/** Constantes d'une consultation, sur une ou deux lignes. */
export function VitalsSummary({ vitals }: { vitals: Vitals }) {
  const { t } = useTranslation();
  const f = useFormat();
  const number = (value: number) => Number(value).toLocaleString(f.locale);
  const bmi = bodyMassIndex(vitals.poids_kg, vitals.taille_cm);
  const parts = [
    vitals.tension_sys && vitals.tension_dia ? `${t('vitals.bloodPressure')} ${vitals.tension_sys}/${vitals.tension_dia}` : null,
    vitals.pouls ? `${t('vitals.short.pulse')} ${vitals.pouls}/min` : null,
    vitals.temperature ? `${t('vitals.short.temperature')} ${number(vitals.temperature)} °C` : null,
    vitals.frequence_respiratoire ? `${t('vitals.short.respiratoryRate')} ${vitals.frequence_respiratoire}/min` : null,
    vitals.saturation ? `${t('vitals.short.saturation')} ${vitals.saturation} %` : null,
    vitals.glycemie ? `${t('vitals.short.glycemia')} ${number(vitals.glycemie)} g/L` : null,
    vitals.poids_kg ? `${number(vitals.poids_kg)} kg` : null,
    vitals.taille_cm ? `${vitals.taille_cm} cm` : null,
    bmi ? `${t('record.bmi')} ${number(bmi)}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <ThemedText type="small">{parts.join(' · ')}</ThemedText>;
}

export const hasVitals = (c: Vitals) =>
  [c.tension_sys, c.pouls, c.temperature, c.frequence_respiratoire, c.saturation, c.glycemie, c.poids_kg, c.taille_cm].some(
    (value) => value != null
  );

/** Dernières constantes connues (consultation la plus récente qui en contient). */
export function LastVitalsCard({ consultations }: { consultations: Consultation[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const last = consultations.find(hasVitals);
  if (!last) return null;
  return (
    <Card>
      <ThemedText type="smallBold">{t('record.lastVitals', { date: f.formatDate(last.date_consultation) })}</ThemedText>
      <VitalsSummary vitals={last} />
    </Card>
  );
}

/** Profil médical : groupe sanguin, électrophorèse, mensurations, habitudes. */
export function MedicalProfileCard({ record, myId }: { record: PatientRecord; myId: string | undefined }) {
  const { t } = useTranslation();
  const f = useFormat();
  const profile = record.profil_medical;
  const isWoman = record.identite?.sexe === 'F';
  const bmi = bodyMassIndex(profile?.poids_kg, profile?.taille_cm);
  return (
    <Card>
      <InfoRow label={t('record.bloodGroup')} value={profile?.groupe_sanguin ?? t('common.notProvided')} />
      <InfoRow
        label={t('record.electrophoresis')}
        value={profile?.electrophorese ? t(`record.electrophoresisValue.${profile.electrophorese}`) : t('common.notProvidedF')}
      />
      <InfoRow label={t('record.height')} value={profile?.taille_cm ? `${profile.taille_cm} cm` : t('common.notProvidedF')} />
      <InfoRow
        label={t('record.weight')}
        value={profile?.poids_kg ? `${Number(profile.poids_kg).toLocaleString(f.locale)} kg` : t('common.notProvided')}
      />
      {bmi ? <InfoRow label={t('record.bmi')} value={bmi.toLocaleString(f.locale)} /> : null}
      <InfoRow label={t('record.tobacco')} value={profile?.tabac ? t(`record.tobaccoValue.${profile.tabac}`) : t('common.notProvided')} />
      <InfoRow label={t('record.alcohol')} value={profile?.alcool ? t(`record.alcoholValue.${profile.alcool}`) : t('common.notProvided')} />
      {isWoman && profile?.grossesse != null ? (
        <InfoRow label={t('record.pregnancy')} value={profile.grossesse ? t('common.yes') : t('common.no')} />
      ) : null}
      {profile ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('record.updatedOn', { date: f.formatDate(profile.updated_at) })}
          {profile.updated_by === myId ? ` · ${t('record.byYou')}` : profile.par_patient ? ` · ${t('record.byPatient')}` : ''}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
