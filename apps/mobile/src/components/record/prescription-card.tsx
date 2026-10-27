import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';
import type { Prescription } from '@/lib/types';

const PRESCRIPTION_TONE = {
  active: 'success',
  terminee: 'info',
  annulee: 'danger',
} as const;

/** Ordonnance : prescripteur, médicaments, horaires et durée. `onStop` : bouton « Arrêter » pour le prescripteur. */
export function PrescriptionCard({ prescription, onStop, busy }: { prescription: Prescription; onStop?: () => void; busy?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const origin = [prescription.prescripteur ? f.doctorName(prescription.prescripteur) : null, prescription.etablissement]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="heading">
          {t('treatments.prescriptionOf', { date: f.formatDate(prescription.date_prescription) })}
        </ThemedText>
        <Badge label={t(`treatments.status.${prescription.statut}`)} tone={PRESCRIPTION_TONE[prescription.statut]} />
        {origin ? (
          <ThemedText type="small" themeColor="textSecondary">
            {origin}
          </ThemedText>
        ) : null}
      </View>
      {prescription.lignes.map((line) => (
        <View key={line.id} style={styles.line}>
          <ThemedText type="smallBold">{line.medicament}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {line.dosage}
            {line.voie ? t('treatments.route', { route: line.voie }) : ''}
            {t('treatments.at', { times: line.horaires.map((h) => h.slice(0, 5)).join(', ') })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('treatments.fromTo', { from: f.formatDate(line.date_debut), to: f.formatDate(line.date_fin) })}
          </ThemedText>
          {line.instructions ? <ThemedText type="small">{line.instructions}</ThemedText> : null}
        </View>
      ))}
      {prescription.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('treatments.doctorNote', { note: prescription.notes })}
        </ThemedText>
      ) : null}
      {onStop && prescription.statut === 'active' ? (
        <Button compact variant="danger" label={t('doctorSpace.stop')} onPress={onStop} loading={busy} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  line: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
  },
});
