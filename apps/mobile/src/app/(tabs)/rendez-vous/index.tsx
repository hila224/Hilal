import { router } from 'expo-router';
import { useState } from 'react';

import { AppointmentCard } from '@/components/appointment-card';
import { AsyncContent, Button, EmptyState, Notice, Screen, Section } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { cancelAppointment, fetchAppointments } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { Appointment } from '@/lib/types';

export default function AppointmentsScreen() {
  const { data, error, loading, refresh } = useData(fetchAppointments);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function cancel(appointment: Appointment) {
    const ok = await confirm(
      'Annuler ce rendez-vous ?',
      `${formatDateTime(appointment.slot.debut)}. Le créneau sera libéré pour un autre patient.`,
      'Annuler le rendez-vous'
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
    <Screen title="Rendez-vous" onRefresh={refresh}>
      <Button label="Prendre rendez-vous" onPress={() => router.push('/rendez-vous/nouveau')} />
      {actionError ? <Notice tone="danger">{actionError}</Notice> : null}

      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title="À venir">
          {data?.upcoming.length ? (
            data.upcoming.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment}>
                <Button
                  compact
                  variant="danger"
                  label="Annuler"
                  loading={cancelling === appointment.id}
                  onPress={() => cancel(appointment)}
                />
              </AppointmentCard>
            ))
          ) : (
            <EmptyState text="Aucun rendez-vous à venir." />
          )}
        </Section>

        <Section title="Historique">
          {data?.past.length ? (
            data.past.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)
          ) : (
            <EmptyState text="Aucun rendez-vous passé." />
          )}
        </Section>
      </AsyncContent>
    </Screen>
  );
}
