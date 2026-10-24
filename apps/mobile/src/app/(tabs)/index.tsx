import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AppointmentCard } from '@/components/appointment-card';
import { IntakeRow } from '@/components/intake-row';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Card, EmptyState, MEDICAL_DISCLAIMER, Notice, Screen, Section } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchAppointments, fetchIntakes } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { notificationsAllowed, requestNotificationPermission } from '@/lib/notifications';

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start, end] as const;
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const { data, error, loading, refresh } = useData(async () => {
    const [appointments, intakes] = await Promise.all([fetchAppointments(), fetchIntakes(...todayBounds())]);
    return { next: appointments.upcoming[0] ?? null, intakes };
  });

  const [askNotifications, setAskNotifications] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') notificationsAllowed().then((allowed) => setAskNotifications(!allowed));
  }, []);

  const remaining = data?.intakes.filter((i) => i.statut === 'a_prendre').length ?? 0;

  return (
    <Screen title={`Bonjour ${profile?.prenom ?? ''}`.trim()} onRefresh={refresh}>
      {askNotifications ? (
        <Card>
          <ThemedText type="smallBold">Activer les rappels de médicaments</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Recevez une notification à l’heure de chaque prise.
          </ThemedText>
          <Button
            compact
            label="Activer"
            onPress={async () => setAskNotifications(!(await requestNotificationPermission()))}
          />
        </Card>
      ) : null}

      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title="Prochain rendez-vous">
          {data?.next ? (
            <AppointmentCard appointment={data.next} />
          ) : (
            <EmptyState text="Aucun rendez-vous à venir." />
          )}
          <Button label="Prendre rendez-vous" onPress={() => router.push('/rendez-vous/nouveau')} />
        </Section>

        <Section title={remaining ? `Médicaments du jour · ${remaining} à prendre` : 'Médicaments du jour'}>
          {data?.intakes.length ? (
            <Card>
              {data.intakes.map((intake) => (
                <IntakeRow key={intake.id} intake={intake} onChange={refresh} />
              ))}
            </Card>
          ) : (
            <EmptyState text="Aucun médicament prévu aujourd’hui." />
          )}
        </Section>
      </AsyncContent>

      <Notice tone="warning">{MEDICAL_DISCLAIMER}</Notice>
    </Screen>
  );
}
