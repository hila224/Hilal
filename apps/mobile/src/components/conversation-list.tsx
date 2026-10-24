import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Card, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { fetchConversations } from '@/lib/api-pro';
import { useFormat } from '@/lib/format';

/** Liste des conversations (patient ou médecin), la plus récente en premier. */
export function ConversationList() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, error, loading, refresh } = useData(fetchConversations);

  return (
    <AsyncContent loading={loading} error={error} retry={refresh}>
      {data?.length ? (
        data.map((conversation) => (
          <Card
            key={`${conversation.patientId}/${conversation.practitionerId}`}
            accessibilityLabel={t('messages.open', { name: conversation.name })}
            onPress={() =>
              router.push({
                pathname: '/conversation',
                params: { patient: conversation.patientId, medecin: conversation.practitionerId },
              })
            }>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
              <ThemedText type="smallBold" style={{ flex: 1 }}>
                {conversation.name || '—'}
              </ThemedText>
              {conversation.unread ? <Badge label={t('messages.unread', { count: conversation.unread })} tone="info" /> : null}
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {conversation.last.contenu}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {f.formatDateTime(conversation.last.created_at)}
            </ThemedText>
          </Card>
        ))
      ) : (
        <EmptyState text={t('messages.none')} />
      )}
    </AsyncContent>
  );
}
