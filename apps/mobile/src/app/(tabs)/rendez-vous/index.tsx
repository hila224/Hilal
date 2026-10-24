import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppointmentCard } from '@/components/appointment-card';
import { AsyncContent, Button, EmptyState, Notice, Screen, Section } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { cancelAppointment, fetchAppointments } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { Appointment } from '@/lib/types';

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, error, loading, refresh } = useData(fetchAppointments);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function cancel(appointment: Appointment) {
    const ok = await confirm(
      t('appointments.cancelTitle'),
      t('appointments.cancelText', { date: f.formatDateTime(appointment.slot.debut) }),
      t('appointments.cancelAction')
    );
    if (!ok) return;
    setCancelling(appointment.id);
    setActionError(null);
    try {
      await cancelAppointment(appointment.id);
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <Screen title={t('appointments.title')} onRefresh={refresh}>
      <Button label={t('home.book')} onPress={() => router.push('/rendez-vous/nouveau')} />
      {actionError ? <Notice tone="danger">{actionError}</Notice> : null}

      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title={t('appointments.upcoming')}>
          {data?.upcoming.length ? (
            data.upcoming.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment}>
                <Button
                  compact
                  variant="danger"
                  label={t('appointments.cancel')}
                  loading={cancelling === appointment.id}
                  onPress={() => cancel(appointment)}
                />
              </AppointmentCard>
            ))
          ) : (
            <EmptyState text={t('appointments.noUpcoming')} />
          )}
        </Section>

        <Section title={t('appointments.history')}>
          {data?.past.length ? (
            data.past.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)
          ) : (
            <EmptyState text={t('appointments.noPast')} />
          )}
        </Section>
      </AsyncContent>
    </Screen>
  );
}
