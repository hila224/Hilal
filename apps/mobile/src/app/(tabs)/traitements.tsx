import { StyleSheet, View } from 'react-native';

import { IntakeRow } from '@/components/intake-row';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Card, EmptyState, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useNow } from '@/hooks/use-now';
import { fetchIntakes, fetchRecord } from '@/lib/api';
import { dayKey, formatDate, formatDay } from '@/lib/format';
import type { MedicationIntake, Prescription } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

async function loadTreatments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [intakes, history, record] = await Promise.all([
    // Aujourd'hui et les 2 jours suivants.
    fetchIntakes(today, new Date(today.getTime() + 3 * DAY_MS)),
    // Les 7 derniers jours, pour le suivi.
    fetchIntakes(new Date(today.getTime() - 7 * DAY_MS), new Date()),
    fetchRecord(),
  ]);
  return { intakes, history, prescriptions: record.ordonnances };
}

export default function TreatmentsScreen() {
  const { data, error, loading, refresh } = useData(loadTreatments);
  const now = useNow();

  const days = new Map<string, MedicationIntake[]>();
  for (const intake of data?.intakes ?? []) {
    const key = dayKey(intake.prevu_a);
    days.set(key, [...(days.get(key) ?? []), intake]);
  }
  const todayKey = dayKey(new Date(now));

  const past = (data?.history ?? []).filter((i) => Date.parse(i.prevu_a) < now);
  const taken = past.filter((i) => i.statut === 'pris').length;

  return (
    <Screen title="Traitements" onRefresh={refresh}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {past.length ? (
          <Card>
            <ThemedText type="smallBold">Suivi des 7 derniers jours</ThemedText>
            <ThemedText type="heading">
              {taken} prise{taken > 1 ? 's' : ''} sur {past.length} ({Math.round((taken / past.length) * 100)} %)
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Votre médecin voit ce suivi. Pensez à cocher chaque prise.
            </ThemedText>
          </Card>
        ) : null}

        {days.size ? (
          [...days].map(([key, intakes]) => (
            <Section key={key} title={key === todayKey ? 'Aujourd’hui' : formatDay(intakes[0].prevu_a)}>
              <Card>
                {intakes.map((intake) => (
                  <IntakeRow key={intake.id} intake={intake} onChange={refresh} />
                ))}
              </Card>
            </Section>
          ))
        ) : (
          <Section title="Plan de prise">
            <EmptyState text="Aucun médicament prévu dans les prochains jours." />
          </Section>
        )}

        <Section title="Mes ordonnances">
          {data?.prescriptions.length ? (
            data.prescriptions.map((prescription) => (
              <PrescriptionCard key={prescription.id} prescription={prescription} />
            ))
          ) : (
            <EmptyState text="Aucune ordonnance." />
          )}
        </Section>
      </AsyncContent>
    </Screen>
  );
}

const PRESCRIPTION_STATUS = {
  active: { label: 'En cours', tone: 'success' },
  terminee: { label: 'Terminée', tone: 'info' },
  annulee: { label: 'Arrêtée', tone: 'danger' },
} as const;

function PrescriptionCard({ prescription }: { prescription: Prescription }) {
  const status = PRESCRIPTION_STATUS[prescription.statut];
  return (
    <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="heading">Ordonnance du {formatDate(prescription.date_prescription)}</ThemedText>
        <Badge label={status.label} tone={status.tone} />
      </View>
      {prescription.lignes.map((line) => (
        <View key={line.id} style={styles.line}>
          <ThemedText type="smallBold">{line.medicament}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {line.dosage}
            {line.voie ? `, voie ${line.voie}` : ''} · à {line.horaires.map((h) => h.slice(0, 5)).join(', ')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Du {formatDate(line.date_debut)} au {formatDate(line.date_fin)}
          </ThemedText>
          {line.instructions ? <ThemedText type="small">{line.instructions}</ThemedText> : null}
        </View>
      ))}
      {prescription.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          Note du médecin : {prescription.notes}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    gap: Spacing.one,
  },
  line: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
  },
});
