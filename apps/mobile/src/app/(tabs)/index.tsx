import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { AppointmentCard } from '@/components/appointment-card';
import { IntakeRow } from '@/components/intake-row';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Card, EmptyState, Notice, Screen, Section } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchAppointments, fetchIntakes } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFormat } from '@/lib/format';
import { notificationsAllowed, requestNotificationPermission } from '@/lib/notifications';

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start, end] as const;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const f = useFormat();
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
    <Screen
      title={profile?.prenom ? t('home.greeting', { name: profile.prenom }) : t('home.greetingNoName')}
      onRefresh={refresh}>
      {askNotifications ? (
        <Card>
          <ThemedText type="smallBold">{t('home.remindersTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('home.remindersText')}
          </ThemedText>
          <Button
            compact
            label={t('home.enable')}
            onPress={async () => setAskNotifications(!(await requestNotificationPermission()))}
          />
        </Card>
      ) : null}

      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title={t('home.nextAppointment')}>
          {data?.next ? <AppointmentCard appointment={data.next} /> : <EmptyState text={t('home.noUpcoming')} />}
          <Button label={t('home.book')} onPress={() => router.push('/rendez-vous/nouveau')} />
        </Section>

        <Section title={remaining ? t('home.medsTodayCount', { count: remaining }) : t('home.medsToday')}>
          {data?.intakes.length ? (
            <Card>
              {data.intakes.map((intake) => (
                <IntakeRow key={intake.id} intake={intake} onChange={refresh} />
              ))}
            </Card>
          ) : (
            <EmptyState text={t('home.noMedsToday')} />
          )}
        </Section>
      </AsyncContent>

      <Notice tone="warning">{f.disclaimer()}</Notice>
    </Screen>
  );
}
