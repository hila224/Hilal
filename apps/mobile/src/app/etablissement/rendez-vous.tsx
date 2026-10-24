import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProAppointmentCard } from '@/components/pro';
import { AsyncContent, EmptyState, Notice, Screen, Section } from '@/components/ui';
import { cancelAppointment, setAppointmentStatus } from '@/lib/api';
import { fetchHospitalAppointments } from '@/lib/api-pro';
import { confirm } from '@/lib/confirm';
import { useFormat } from '@/lib/format';
import { useHospitalData } from '@/lib/hospital-context';
import { errorMessage } from '@/lib/supabase';
import type { Appointment } from '@/lib/types';

export default function HospitalAppointmentsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, error, loading, refresh } = useHospitalData((hospital) => fetchHospitalAppointments(hospital.id));
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function cancel(appointment: Appointment) {
    const ok = await confirm(
      t('appointments.cancelTitle'),
      t('appointments.cancelText', { date: f.formatDateTime(appointment.slot.debut) }),
      t('appointments.cancelAction')
    );
    if (ok) run(appointment.id, () => cancelAppointment(appointment.id));
  }

  // Rendez-vous passés encore « confirmés » : à marquer comme effectués ou manqués.
  const toClose = data?.past.filter((a) => a.statut === 'confirme') ?? [];
  const history = data?.past.filter((a) => a.statut !== 'confirme') ?? [];

  return (
    <Screen title={t('appointments.title')} onRefresh={refresh}>
      {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {toClose.length ? (
          <Section title={t('hospitalSpace.toClose')}>
            {toClose.map((appointment) => (
              <ProAppointmentCard
                key={appointment.id}
                appointment={appointment}
                showDoctor
                busy={busy === appointment.id}
                onStatus={(statut) => run(appointment.id, () => setAppointmentStatus(appointment.id, statut))}
              />
            ))}
          </Section>
        ) : null}

        <Section title={t('appointments.upcoming')}>
          {data?.upcoming.length ? (
            data.upcoming.map((appointment) => (
              <ProAppointmentCard
                key={appointment.id}
                appointment={appointment}
                showDoctor
                busy={busy === appointment.id}
                onCancel={() => cancel(appointment)}
              />
            ))
          ) : (
            <EmptyState text={t('appointments.noUpcoming')} />
          )}
        </Section>

        <Section title={t('appointments.history')}>
          {history.length ? (
            history.slice(0, 50).map((appointment) => (
              <ProAppointmentCard key={appointment.id} appointment={appointment} showDoctor />
            ))
          ) : (
            <EmptyState text={t('appointments.noPast')} />
          )}
        </Section>
      </AsyncContent>
    </Screen>
  );
}
