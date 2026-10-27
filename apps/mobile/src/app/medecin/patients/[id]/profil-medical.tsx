import { router, useLocalSearchParams } from 'expo-router';

import { MedicalProfileForm } from '@/components/record/medical-profile-form';
import { AsyncContent, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchMedicalProfile, fetchPatientSex } from '@/lib/api-record';

export default function DoctorMedicalProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refresh } = useData(async () => {
    const [profile, sex] = await Promise.all([fetchMedicalProfile(id), fetchPatientSex(id)]);
    return { profile, sex };
  });
  return (
    <Screen edgeTop={false}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? <MedicalProfileForm patientId={id} initial={data.profile} sex={data.sex} onDone={() => router.back()} /> : null}
      </AsyncContent>
    </Screen>
  );
}
