import { useTranslation } from 'react-i18next';

import { ConversationList } from '@/components/conversation-list';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';

export default function PatientMessagesScreen() {
  const { t } = useTranslation();
  return (
    <Screen edgeTop={false}>
      <ThemedText themeColor="textSecondary">{t('messages.patientIntro')}</ThemedText>
      <ConversationList />
    </Screen>
  );
}
