import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ConsultationReport } from '@/components/record/consultation-card';
import { AsyncContent, Button, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { fetchConsultationDetail } from '@/lib/api-record';
import { useAuth } from '@/lib/auth-context';

/** Compte rendu d'une consultation ; son auteur peut le corriger, prescrire ou joindre un document. */
export default function DoctorConsultationReportScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { id, cid } = useLocalSearchParams<{ id: string; cid: string }>();
  const { data, error, loading, refresh } = useData(() => fetchConsultationDetail(cid));
  const mine = data?.consultation.practitioner_id === session?.user.id;

  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? (
          <>
            {mine ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                <Button
                  compact
                  label={t('consultation.edit')}
                  onPress={() => router.push({ pathname: '/medecin/patients/[id]/consultation', params: { id, cid } })}
                />
                <Button
                  compact
                  variant="secondary"
                  label={t('consultation.prescribe')}
                  onPress={() => router.push({ pathname: '/medecin/patients/[id]/ordonnance', params: { id, cid } })}
                />
                <Button
                  compact
                  variant="secondary"
                  label={t('consultation.addDocument')}
                  onPress={() => router.push({ pathname: '/medecin/patients/[id]/document', params: { id, cid } })}
                />
              </View>
            ) : null}
            <ConsultationReport {...data} myId={session?.user.id} onChanged={refresh} />
          </>
        ) : null}
      </AsyncContent>
    </Screen>
  );
}
