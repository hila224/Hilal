import { router, useLocalSearchParams } from 'expo-router';

import { DocumentForm } from '@/components/record/document-form';
import { Screen } from '@/components/ui';

/** Le médecin joint un document au dossier, éventuellement à une consultation (cid). */
export default function DoctorAddDocumentScreen() {
  const { id, cid } = useLocalSearchParams<{ id: string; cid?: string }>();
  return (
    <Screen edgeTop={false}>
      <DocumentForm patientId={id} consultationId={cid ?? null} onDone={() => router.back()} />
    </Screen>
  );
}
