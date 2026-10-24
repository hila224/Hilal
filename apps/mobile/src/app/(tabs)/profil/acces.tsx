import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Card, EmptyState, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchRecordAccesses } from '@/lib/api';
import { doctorName, formatDateTime } from '@/lib/format';

export default function RecordAccessScreen() {
  const { data, error, loading, refresh } = useData(fetchRecordAccesses);

  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <ThemedText themeColor="textSecondary">
        Liste des consultations de votre dossier médical par des soignants. Si une consultation
        vous semble anormale, contactez l’hôpital.
      </ThemedText>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data?.length ? (
          data.map((entry) => (
            <Card key={entry.id}>
              <ThemedText type="smallBold">
                {entry.actor?.role === 'medecin' ? doctorName(entry.actor) : 'Personnel de l’hôpital'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDateTime(entry.at)}
              </ThemedText>
            </Card>
          ))
        ) : (
          <EmptyState text="Aucun soignant n’a encore consulté votre dossier." />
        )}
      </AsyncContent>
    </Screen>
  );
}
