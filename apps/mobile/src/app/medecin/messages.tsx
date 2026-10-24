import { useTranslation } from 'react-i18next';

import { ConversationList } from '@/components/conversation-list';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';

export default function DoctorMessagesScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('messages.title')}>
      <ThemedText themeColor="textSecondary">{t('messages.doctorIntro')}</ThemedText>
      <ConversationList />
    </Screen>
  );
}
