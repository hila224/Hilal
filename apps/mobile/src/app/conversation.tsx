import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, EmptyState, Notice, Screen, TextField } from '@/components/ui';
import { PAYS } from '@/constants/pays';
import { Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { fetchMessages, fetchProfileName, markMessagesRead, sendMessage } from '@/lib/api-pro';
import { useAuth } from '@/lib/auth-context';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';

/** Conversation entre un patient et un médecin. Paramètres : patient, medecin. */
export default function ConversationScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const theme = useTheme();
  const { session, profile } = useAuth();
  const { patient, medecin } = useLocalSearchParams<{ patient: string; medecin: string }>();
  const uid = session?.user.id;
  const otherId = uid === patient ? medecin : patient;

  const { data, error, loading, refresh } = useData(async () => {
    const [messages, name] = await Promise.all([fetchMessages(patient, medecin), fetchProfileName(otherId)]);
    return { messages, name };
  });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Les messages reçus sont marqués comme lus à l'ouverture.
  const unread = data?.messages.some((m) => m.auteur_id !== uid && !m.lu_at);
  useEffect(() => {
    if (unread) markMessagesRead(patient, medecin).catch(() => {});
  }, [unread, patient, medecin]);

  async function send() {
    const contenu = text.trim();
    if (!contenu) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(patient, medecin, contenu);
      setText('');
      await refresh();
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  const title = data?.name ? (profile?.role === 'patient' ? t('format.doctor', { name: data.name }) : data.name) : t('messages.title');

  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <Stack.Screen options={{ title }} />
      <Notice tone="info">{t('messages.notUrgent', PAYS.urgences)}</Notice>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data?.messages.length ? (
          <View style={styles.thread}>
            {data.messages.map((message) => {
              const mine = message.auteur_id === uid;
              return (
                <View
                  key={message.id}
                  style={[
                    styles.bubble,
                    mine
                      ? { alignSelf: 'flex-end', backgroundColor: theme.primary }
                      : { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  <ThemedText style={{ color: mine ? theme.onPrimary : theme.text }}>{message.contenu}</ThemedText>
                  <ThemedText type="small" style={{ color: mine ? theme.onPrimary : theme.textSecondary, opacity: 0.8 }}>
                    {f.formatDateTime(message.created_at)}
                    {mine && message.lu_at ? ` · ${t('messages.read')}` : ''}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState text={t('messages.empty')} />
        )}
      </AsyncContent>

      <TextField
        label={t('messages.write')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        placeholder={t('messages.placeholder')}
      />
      {sendError ? <Notice tone="danger">{sendError}</Notice> : null}
      <Button label={t('messages.send')} onPress={send} loading={sending} disabled={!text.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  thread: {
    gap: Spacing.two,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
