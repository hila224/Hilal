import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Card, EmptyState, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchRecordAccesses } from '@/lib/api';
import { useFormat } from '@/lib/format';

export default function RecordAccessScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, error, loading, refresh } = useData(fetchRecordAccesses);

  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <ThemedText themeColor="textSecondary">{t('access.intro')}</ThemedText>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data?.length ? (
          data.map((entry) => (
            <Card key={entry.id}>
              <ThemedText type="smallBold">
                {entry.actor?.role === 'medecin' ? f.doctorName(entry.actor) : t('access.staff')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {f.formatDateTime(entry.at)}
              </ThemedText>
            </Card>
          ))
        ) : (
          <EmptyState text={t('access.none')} />
        )}
      </AsyncContent>
    </Screen>
  );
}
