import { router } from 'expo-router';

import { DocumentForm } from '@/components/record/document-form';
import { Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function AddDocumentScreen() {
  const { patient } = useAuth();
  return <Screen edgeTop={false}>{patient ? <DocumentForm patientId={patient.id} onDone={() => router.back()} /> : null}</Screen>;
}
