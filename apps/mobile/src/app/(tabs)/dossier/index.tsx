import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RecordView } from '@/components/record/record-view';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Card, Screen } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/** Dossier médical du patient : il le consulte et le complète. */
export default function RecordScreen() {
  const { t } = useTranslation();
  const { session, patient } = useAuth();
  const { data, error, loading, refresh } = useData(fetchRecord);
  const incomplete = !patient?.date_naissance || !patient?.sexe || !patient?.contact_urgence_tel;

  return (
    <Screen title={t('record.title')} subtitle={t('record.subtitle')} onRefresh={refresh}>
      {incomplete ? (
        <Card>
          <ThemedText type="small">{t('record.completeInfo')}</ThemedText>
          <Button compact label={t('record.completeInfoButton')} onPress={() => router.push('/dossier/informations')} />
        </Card>
      ) : null}
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? (
          <RecordView
            record={data}
            myId={session?.user.id}
            onChanged={refresh}
            links={{
              editProfile: () => router.push('/dossier/profil-medical'),
              add: (kind) => router.push({ pathname: '/dossier/ajouter', params: { type: kind } }),
              addDocument: () => router.push('/dossier/document'),
              openConsultation: (id) => router.push({ pathname: '/dossier/compte-rendu', params: { id } }),
            }}
          />
        ) : null}
      </AsyncContent>
    </Screen>
  );
}
