import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EntryForm } from '@/components/record/entry-form';
import { Screen } from '@/components/ui';
import { isEntryKind } from '@/lib/api-record';
import { useAuth } from '@/lib/auth-context';

/** Le patient ajoute une allergie, un antécédent, un traitement habituel ou un vaccin. */
export default function AddEntryScreen() {
  const { t } = useTranslation();
  const { patient } = useAuth();
  const { type } = useLocalSearchParams<{ type: string }>();
  const kind = isEntryKind(type) ? type : 'allergie';
  return (
    <Screen edgeTop={false}>
      <Stack.Screen options={{ title: t(`entry.title.${kind}`) }} />
      {patient ? <EntryForm kind={kind} patientId={patient.id} onDone={() => router.back()} /> : null}
    </Screen>
  );
}
