import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Button, Card, EmptyState, InfoRow, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { fetchRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFormat } from '@/lib/format';
import type { Severity } from '@/lib/types';

const SEVERITY_TONE: Record<Severity, 'info' | 'warning' | 'danger'> = {
  faible: 'info',
  moderee: 'warning',
  severe: 'danger',
};

/** Dossier d'un patient suivi, en lecture. Chaque ouverture est tracée et visible par le patient. */
export default function DoctorPatientRecordScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refresh } = useData(() => fetchRecord(id));
  const identity = data?.identite;

  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <Notice tone="info">{t('doctorSpace.traced')}</Notice>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? (
          <>
            <Card>
              <ThemedText type="heading">
                {identity?.prenom} {identity?.nom}
              </ThemedText>
              {identity?.date_naissance ? (
                <InfoRow label={t('profile.birthDate')} value={f.formatDate(identity.date_naissance)} />
              ) : null}
              <InfoRow label={t('record.bloodGroup')} value={data.profil_medical?.groupe_sanguin ?? t('common.notProvided')} />
              <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
                <Button
                  compact
                  label={t('doctorSpace.writeToPatient')}
                  onPress={() =>
                    session && router.push({ pathname: '/conversation', params: { patient: id, medecin: session.user.id } })
                  }
                />
              </View>
            </Card>

            <Section title={t('record.allergies')}>
              {data.allergies.length ? (
                data.allergies.map((allergy) => (
                  <Card key={allergy.id}>
                    <ThemedText type="smallBold">{allergy.substance}</ThemedText>
                    {allergy.severite ? (
                      <Badge label={t(`record.severity.${allergy.severite}`)} tone={SEVERITY_TONE[allergy.severite]} />
                    ) : null}
                    {allergy.reaction ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('record.reaction', { reaction: allergy.reaction })}
                      </ThemedText>
                    ) : null}
                  </Card>
                ))
              ) : (
                <EmptyState text={t('record.noAllergies')} />
              )}
            </Section>

            <Section title={t('record.history')}>
              {data.antecedents.length ? (
                <Card>
                  {data.antecedents.map((item) => (
                    <ThemedText key={item.id} type="small">
                      • {item.description} ({t(`record.historyType.${item.type}`)})
                    </ThemedText>
                  ))}
                </Card>
              ) : (
                <EmptyState text={t('record.noHistory')} />
              )}
            </Section>

            <Section title={t('treatments.prescriptions')}>
              {data.ordonnances.length ? (
                data.ordonnances.map((prescription) => (
                  <Card key={prescription.id}>
                    <ThemedText type="smallBold">
                      {t('treatments.prescriptionOf', { date: f.formatDate(prescription.date_prescription) })} ·{' '}
                      {t(`treatments.status.${prescription.statut}`)}
                    </ThemedText>
                    {prescription.lignes.map((line) => (
                      <ThemedText key={line.id} type="small">
                        • {line.medicament} — {line.dosage}
                      </ThemedText>
                    ))}
                  </Card>
                ))
              ) : (
                <EmptyState text={t('treatments.noPrescriptions')} />
              )}
            </Section>
          </>
        ) : null}
      </AsyncContent>
    </Screen>
  );
}
