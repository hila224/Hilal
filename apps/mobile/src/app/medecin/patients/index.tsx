import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Card, EmptyState, Screen, TextField } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchMyPatients } from '@/lib/api-pro';
import { useFormat } from '@/lib/format';

/** Patients suivis : ceux qui ont pris rendez-vous ou choisi ce médecin comme médecin traitant. */
export default function DoctorPatientsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, error, loading, refresh } = useData(fetchMyPatients);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const patients = (data ?? []).filter((p) => !query || `${p.prenom} ${p.nom}`.toLowerCase().includes(query));

  return (
    <Screen title={t('tabs.patients')} onRefresh={refresh}>
      <ThemedText themeColor="textSecondary">{t('doctorSpace.patientsIntro')}</ThemedText>
      <TextField label={t('treatingDoctor.search')} value={search} onChangeText={setSearch} />
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {patients.length ? (
          patients.map((patient) => (
            <Card
              key={patient.id}
              accessibilityLabel={`${patient.prenom} ${patient.nom}`}
              onPress={() => router.push({ pathname: '/medecin/patients/[id]', params: { id: patient.id } })}>
              <ThemedText type="heading">
                {patient.prenom} {patient.nom}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('doctorSpace.followedSince', { date: f.formatDate(patient.depuis) })}
              </ThemedText>
            </Card>
          ))
        ) : (
          <EmptyState text={t('doctorSpace.noPatients')} />
        )}
      </AsyncContent>
    </Screen>
  );
}
