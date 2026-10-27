import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AuthorLine } from '@/components/record/parts';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Notice } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { documentUrl } from '@/lib/api';
import { deleteDocument } from '@/lib/api-record';
import { confirm } from '@/lib/confirm';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { MedicalDocument } from '@/lib/types';

/** Documents du dossier : ouverture par lien temporaire, retrait de ses propres dépôts. */
export function DocumentList({ documents, myId, onChanged }: {
  documents: MedicalDocument[];
  myId: string | undefined;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(document: MedicalDocument) {
    setBusy(document.id);
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(await documentUrl(document.storage_path));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(document: MedicalDocument) {
    if (!(await confirm(t('record.removeTitle'), document.titre, t('record.remove')))) return;
    setBusy(document.id);
    setError(null);
    try {
      await deleteDocument(document);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!documents.length) return <EmptyState text={t('record.noDocuments')} />;
  return (
    <>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {documents.map((document) => (
        <Card key={document.id} onPress={() => open(document)} accessibilityLabel={t('record.open', { title: document.titre })}>
          <ThemedText type="smallBold">{document.titre}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`record.documentType.${document.type}`)} · {f.formatDate(document.created_at)}
            {busy === document.id ? ` · ${t('record.opening')}` : ''}
          </ThemedText>
          {document.description ? <ThemedText type="small">{document.description}</ThemedText> : null}
          <AuthorLine item={document} myId={myId} />
          {document.created_by === myId ? (
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button compact variant="secondary" label={t('record.remove')} onPress={() => remove(document)} disabled={busy === document.id} />
            </View>
          ) : null}
        </Card>
      ))}
    </>
  );
}
