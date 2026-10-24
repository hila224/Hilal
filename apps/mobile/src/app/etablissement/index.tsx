import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HospitalStatusBadge, HospitalSummary, ProAppointmentCard } from '@/components/pro';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Card, EmptyState, InfoRow, Notice, Screen, Section } from '@/components/ui';
import { fetchHospitalAppointments, fetchHospitalCatalog, fetchHospitalDoctors } from '@/lib/api-pro';
import { dayKey } from '@/lib/format';
import { useHospital, useHospitalData } from '@/lib/hospital-context';

/** Tableau de bord de l'établissement. */
export default function HospitalDashboard() {
  const { t } = useTranslation();
  const { hospital, error: hospitalError, reload } = useHospital();

  const { data, error, loading, refresh } = useHospitalData(async (hospital) => {
    const [appointments, doctors, catalog] = await Promise.all([
      fetchHospitalAppointments(hospital.id),
      fetchHospitalDoctors(hospital.id),
      fetchHospitalCatalog(hospital.id),
    ]);
    const today = dayKey(new Date());
    return {
      today: appointments.upcoming.filter((a) => dayKey(a.slot.debut) === today),
      next: appointments.upcoming.slice(0, 5),
      doctors: doctors.doctors.filter((d) => d.actif).length,
      services: catalog.services.filter((s) => s.actif).length,
      tarifs: catalog.tarifs.filter((tarif) => tarif.actif).length,
    };
  });

  const refreshAll = async () => {
    await reload();
    await refresh();
  };

  if (!hospital) {
    return (
      <Screen title={t('tabs.dashboard')}>
        <AsyncContent loading={!hospitalError} error={hospitalError} retry={reload}>
          {null}
        </AsyncContent>
      </Screen>
    );
  }

  return (
    <Screen title={hospital.nom} onRefresh={refreshAll}>
      <Card>
        <HospitalStatusBadge statut={hospital.statut} />
        <HospitalSummary hospital={hospital} />
      </Card>

      {hospital.statut === 'en_attente' ? <Notice tone="warning">{t('hospitalSpace.pending')}</Notice> : null}
      {hospital.statut === 'refuse' || hospital.statut === 'suspendu' ? (
        <Notice tone="danger">
          {t('hospitalSpace.rejected')}
          {hospital.motif_refus ? ` ${t('hospitalSpace.reason', { reason: hospital.motif_refus })}` : ''}
        </Notice>
      ) : null}

      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? (
          <>
            <Card>
              <InfoRow label={t('hospitalSpace.todayCount')} value={String(data.today.length)} />
              <InfoRow label={t('hospitalSpace.doctorCount')} value={String(data.doctors)} />
              <InfoRow label={t('hospitalSpace.serviceCount')} value={String(data.services)} />
              <InfoRow label={t('hospitalSpace.priceCount')} value={String(data.tarifs)} />
            </Card>

            {hospital.statut === 'valide' && (data.services === 0 || data.doctors === 0 || data.tarifs === 0) ? (
              <Card>
                <ThemedText type="smallBold">{t('hospitalSpace.checklistTitle')}</ThemedText>
                {data.services === 0 ? <ThemedText type="small">• {t('hospitalSpace.checkServices')}</ThemedText> : null}
                {data.tarifs === 0 ? <ThemedText type="small">• {t('hospitalSpace.checkPrices')}</ThemedText> : null}
                {data.doctors === 0 ? <ThemedText type="small">• {t('hospitalSpace.checkDoctors')}</ThemedText> : null}
              </Card>
            ) : null}

            <Section title={t('hospitalSpace.nextAppointments')}>
              {data.next.length ? (
                data.next.map((appointment) => (
                  <ProAppointmentCard key={appointment.id} appointment={appointment} showDoctor />
                ))
              ) : (
                <EmptyState text={t('appointments.noUpcoming')} />
              )}
              <Button variant="secondary" label={t('hospitalSpace.allAppointments')} onPress={() => router.push('/etablissement/rendez-vous')} />
            </Section>
          </>
        ) : null}
      </AsyncContent>
    </Screen>
  );
}
