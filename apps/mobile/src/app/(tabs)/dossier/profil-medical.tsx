import { router } from 'expo-router';

import { MedicalProfileForm } from '@/components/record/medical-profile-form';
import { AsyncContent, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { currentUserId } from '@/lib/api';
import { fetchMedicalProfile } from '@/lib/api-record';
import { useAuth } from '@/lib/auth-context';

export default function MyMedicalProfileScreen() {
  const { patient } = useAuth();
  const { data, error, loading, refresh } = useData(async () => fetchMedicalProfile(await currentUserId()));
  return (
    <Screen edgeTop={false}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {patient ? <MedicalProfileForm patientId={patient.id} initial={data} sex={patient.sexe} onDone={() => router.back()} /> : null}
      </AsyncContent>
    </Screen>
  );
}
