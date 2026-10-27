import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EntryForm } from '@/components/record/entry-form';
import { Screen } from '@/components/ui';
import { isEntryKind } from '@/lib/api-record';

/** Le médecin ajoute une allergie, un antécédent, un traitement habituel ou un vaccin. */
export default function DoctorAddEntryScreen() {
  const { t } = useTranslation();
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const kind = isEntryKind(type) ? type : 'allergie';
  return (
    <Screen edgeTop={false}>
      <Stack.Screen options={{ title: t(`entry.title.${kind}`) }} />
      <EntryForm kind={kind} patientId={id} onDone={() => router.back()} />
    </Screen>
  );
}
