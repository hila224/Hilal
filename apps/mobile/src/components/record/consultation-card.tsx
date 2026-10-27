import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DocumentList } from '@/components/record/document-list';
import { hasVitals, VitalsSummary } from '@/components/record/parts';
import { PrescriptionCard } from '@/components/record/prescription-card';
import { ThemedText } from '@/components/themed-text';
import { Card, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';
import type { Consultation, MedicalDocument, Prescription } from '@/lib/types';

function origin(consultation: Consultation, doctorName: (p: { prenom: string; nom: string } | null) => string) {
  return [consultation.medecin ? `${doctorName(consultation.medecin)} (${consultation.medecin.specialite})` : null, consultation.etablissement]
    .filter(Boolean)
    .join(' · ');
}

/** Résumé d'une consultation dans la liste du dossier. */
export function ConsultationCard({ consultation, onPress }: { consultation: Consultation; onPress: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <Card onPress={onPress} accessibilityLabel={t('record.consultationOf', { date: f.formatDate(consultation.date_consultation) })}>
      <ThemedText type="heading">{t('record.consultationOf', { date: f.formatDate(consultation.date_consultation) })}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {origin(consultation, f.doctorName)}
      </ThemedText>
      <ThemedText type="small">
        <ThemedText type="smallBold">{t('consultation.motif')} : </ThemedText>
        {consultation.motif}
      </ThemedText>
      {consultation.diagnostic ? (
        <ThemedText type="small">
          <ThemedText type="smallBold">{t('consultation.diagnosis')} : </ThemedText>
          {consultation.diagnostic}
        </ThemedText>
      ) : null}
      {hasVitals(consultation) ? <VitalsSummary vitals={consultation} /> : null}
    </Card>
  );
}

/** Compte rendu complet d'une consultation, avec ses ordonnances et documents. */
export function ConsultationReport({ consultation, prescriptions, documents, myId, onChanged }: {
  consultation: Consultation;
  prescriptions: Prescription[];
  documents: MedicalDocument[];
  myId: string | undefined;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const blocks = [
    [t('consultation.motif'), consultation.motif],
    [t('consultation.history'), consultation.histoire],
    [t('consultation.exam'), consultation.examen],
    [t('consultation.diagnosis'), consultation.diagnostic],
    [t('consultation.plan'), consultation.conduite],
  ] as const;

  return (
    <>
      <Card>
        <ThemedText type="heading">{t('record.consultationOf', { date: f.formatDateTime(consultation.date_consultation) })}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {origin(consultation, f.doctorName)}
        </ThemedText>
        {blocks.map(([label, text]) =>
          text ? (
            <View key={label} style={styles.block}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <ThemedText>{text}</ThemedText>
            </View>
          ) : null
        )}
      </Card>
      {hasVitals(consultation) ? (
        <Section title={t('vitals.title')}>
          <Card>
            <VitalsSummary vitals={consultation} />
          </Card>
        </Section>
      ) : null}
      {prescriptions.length ? (
        <Section title={t('consultation.prescriptions')}>
          {prescriptions.map((prescription) => (
            <PrescriptionCard key={prescription.id} prescription={prescription} />
          ))}
        </Section>
      ) : null}
      {documents.length ? (
        <Section title={t('consultation.documents')}>
          <DocumentList documents={documents} myId={myId} onChanged={onChanged} />
        </Section>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.half,
  },
});
