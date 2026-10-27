import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProAppointmentCard } from '@/components/pro';
import { AsyncContent, EmptyState, Notice, Screen, Section } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { setAppointmentStatus } from '@/lib/api';
import { fetchDoctorAppointments } from '@/lib/api-pro';
import { useAuth } from '@/lib/auth-context';
import { dayKey, useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { Appointment } from '@/lib/types';

/** Agenda du médecin, tous établissements confondus. */
export default function DoctorAgendaScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useAuth();
  const { data, error, loading, refresh } = useData(fetchDoctorAppointments);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function mark(id: string, statut: 'honore' | 'absent') {
    setBusy(id);
    setActionError(null);
    try {
      await setAppointmentStatus(id, statut);
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  // Dossier du patient et consultation du rendez-vous.
  const links = (appointment: Appointment) => {
    const patientId = appointment.patient?.id;
    if (!patientId) return {};
    return {
      onOpenRecord: () => router.push({ pathname: '/medecin/patients/[id]', params: { id: patientId } }),
      onConsult: () => router.push({ pathname: '/medecin/patients/[id]/consultation', params: { id: patientId, rdv: appointment.id } }),
    };
  };

  const days = new Map<string, Appointment[]>();
  for (const appointment of data?.upcoming ?? []) {
    const key = dayKey(appointment.slot.debut);
    days.set(key, [...(days.get(key) ?? []), appointment]);
  }
  const toClose = data?.past.filter((a) => a.statut === 'confirme') ?? [];

  return (
    <Screen title={t('home.greeting', { name: f.doctorName(profile) })} onRefresh={refresh}>
      {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {toClose.length ? (
          <Section title={t('hospitalSpace.toClose')}>
            {toClose.map((appointment) => (
              <ProAppointmentCard
                key={appointment.id}
                appointment={appointment}
                showHospital
                busy={busy === appointment.id}
                onStatus={(statut) => mark(appointment.id, statut)}
                {...links(appointment)}
              />
            ))}
          </Section>
        ) : null}

        {days.size ? (
          [...days].map(([key, appointments]) => (
            <Section key={key} title={f.formatDay(appointments[0].slot.debut)}>
              {appointments.map((appointment) => (
                <ProAppointmentCard key={appointment.id} appointment={appointment} showHospital {...links(appointment)} />
              ))}
            </Section>
          ))
        ) : (
          <Section title={t('tabs.agenda')}>
            <EmptyState text={t('appointments.noUpcoming')} />
          </Section>
        )}
      </AsyncContent>
    </Screen>
  );
}
