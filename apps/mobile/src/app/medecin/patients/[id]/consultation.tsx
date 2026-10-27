import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ConsultationForm } from '@/components/record/consultation-form';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { setAppointmentStatus } from '@/lib/api';
import { fetchConsultationContext } from '@/lib/api-record';

/**
 * Nouvelle consultation (depuis la fiche ou un rendez-vous) ou correction d'une consultation.
 * Paramètres : id (patient), cid (consultation à corriger), rdv (rendez-vous d'origine).
 */
export default function ConsultationScreen() {
  const { t } = useTranslation();
  const { id, cid, rdv } = useLocalSearchParams<{ id: string; cid?: string; rdv?: string }>();
  const { data, error, loading, refresh } = useData(() => fetchConsultationContext({ consultationId: cid, appointmentId: rdv }));

  async function done(consultationId: string, prescribe: boolean) {
    // Le rendez-vous documenté est clos (« effectué »).
    if (data?.appointment?.statut === 'confirme') await setAppointmentStatus(data.appointment.id, 'honore').catch(() => undefined);
    if (prescribe) router.replace({ pathname: '/medecin/patients/[id]/ordonnance', params: { id, cid: consultationId } });
    else router.back();
  }

  return (
    <Screen edgeTop={false}>
      <Stack.Screen options={{ title: data?.existing ? t('consultation.editTitle') : t('consultation.newTitle') }} />
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? (
          <>
            {!data.hospitals.length && !data.existing ? (
              <ThemedText type="small" themeColor="warning">
                {t('doctorSpace.noHospital')}
              </ThemedText>
            ) : null}
            <ConsultationForm
              key={data.existing?.id ?? 'nouvelle'}
              patientId={id}
              existing={data.existing}
              context={{ hospitals: data.hospitals, appointment: data.appointment }}
              onDone={done}
            />
          </>
        ) : null}
      </AsyncContent>
    </Screen>
  );
}
