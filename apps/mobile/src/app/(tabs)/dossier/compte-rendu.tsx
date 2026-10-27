import { useLocalSearchParams } from 'expo-router';

import { ConsultationReport } from '@/components/record/consultation-card';
import { AsyncContent, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchConsultationDetail } from '@/lib/api-record';
import { useAuth } from '@/lib/auth-context';

/** Compte rendu d'une consultation, vu par le patient. */
export default function ConsultationReportScreen() {
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refresh } = useData(() => fetchConsultationDetail(id));
  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? <ConsultationReport {...data} myId={session?.user.id} onChanged={refresh} /> : null}
      </AsyncContent>
    </Screen>
  );
}
