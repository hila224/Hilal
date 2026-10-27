import { useTranslation } from 'react-i18next';

import { IntakeRow } from '@/components/intake-row';
import { PrescriptionCard } from '@/components/record/prescription-card';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Card, EmptyState, Screen, Section } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { useNow } from '@/hooks/use-now';
import { fetchIntakes, fetchRecord } from '@/lib/api';
import { dayKey, useFormat } from '@/lib/format';
import type { MedicationIntake } from '@/lib/types';

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
  const { t } = useTranslation();
  const f = useFormat();
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
    <Screen title={t('treatments.title')} onRefresh={refresh}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {past.length ? (
          <Card>
            <ThemedText type="smallBold">{t('treatments.adherenceTitle')}</ThemedText>
            <ThemedText type="heading">
              {t('treatments.adherence', {
                taken,
                total: past.length,
                percent: Math.round((taken / past.length) * 100),
              })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('treatments.adherenceNote')}
            </ThemedText>
          </Card>
        ) : null}

        {days.size ? (
          [...days].map(([key, intakes]) => (
            <Section key={key} title={key === todayKey ? t('treatments.today') : f.formatDay(intakes[0].prevu_a)}>
              <Card>
                {intakes.map((intake) => (
                  <IntakeRow key={intake.id} intake={intake} onChange={refresh} />
                ))}
              </Card>
            </Section>
          ))
        ) : (
          <Section title={t('treatments.plan')}>
            <EmptyState text={t('treatments.noUpcoming')} />
          </Section>
        )}

        <Section title={t('treatments.prescriptions')}>
          {data?.prescriptions.length ? (
            data.prescriptions.map((prescription) => (
              <PrescriptionCard key={prescription.id} prescription={prescription} />
            ))
          ) : (
            <EmptyState text={t('treatments.noPrescriptions')} />
          )}
        </Section>
      </AsyncContent>
    </Screen>
  );
}
