import { router, useLocalSearchParams } from 'expo-router';

import { PrescriptionForm } from '@/components/record/prescription-form';
import { AsyncContent, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchPrescriptionContext } from '@/lib/api-record';

/** Nouvelle ordonnance, éventuellement rattachée à une consultation (cid). */
export default function PrescriptionScreen() {
  const { id, cid } = useLocalSearchParams<{ id: string; cid?: string }>();
  const { data, error, loading, refresh } = useData(() => fetchPrescriptionContext(id));
  return (
    <Screen edgeTop={false}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? <PrescriptionForm patientId={id} consultationId={cid ?? null} context={data} onDone={() => router.back()} /> : null}
      </AsyncContent>
    </Screen>
  );
}
