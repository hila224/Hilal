import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Card, EmptyState, InfoRow, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { documentUrl, fetchRecord } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { MedicalDocument, Severity } from '@/lib/types';

const SEVERITY_TONE: Record<Severity, 'info' | 'warning' | 'danger'> = {
  faible: 'info',
  moderee: 'warning',
  severe: 'danger',
};

export default function RecordScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, error, loading, refresh } = useData(fetchRecord);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function open(document: MedicalDocument) {
    setOpening(document.id);
    setOpenError(null);
    try {
      await WebBrowser.openBrowserAsync(await documentUrl(document.storage_path));
    } catch (e) {
      setOpenError(errorMessage(e));
    } finally {
      setOpening(null);
    }
  }

  const medical = data?.profil_medical;

  return (
    <Screen
      title={t('record.title')}
      subtitle={t('record.subtitle')}
      onRefresh={refresh}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title={t('record.general')}>
          <Card>
            <InfoRow label={t('record.bloodGroup')} value={medical?.groupe_sanguin ?? t('common.notProvided')} />
            <InfoRow label={t('record.height')} value={medical?.taille_cm ? `${medical.taille_cm} cm` : t('common.notProvidedF')} />
            <InfoRow
              label={t('record.weight')}
              value={medical?.poids_kg ? `${Number(medical.poids_kg).toLocaleString(f.locale)} kg` : t('common.notProvided')}
            />
            {medical ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('record.updatedOn', { date: f.formatDate(medical.updated_at) })}
              </ThemedText>
            ) : null}
          </Card>
        </Section>

        <Section title={t('record.allergies')}>
          {data?.allergies.length ? (
            data.allergies.map((allergy) => (
              <Card key={allergy.id}>
                <View style={styles.titleRow}>
                  <ThemedText type="heading" style={styles.flex}>
                    {allergy.substance}
                  </ThemedText>
                  {allergy.severite ? (
                    <Badge label={t(`record.severity.${allergy.severite}`)} tone={SEVERITY_TONE[allergy.severite]} />
                  ) : null}
                </View>
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
          {data?.antecedents.length ? (
            <Card>
              {data.antecedents.map((item) => (
                <View key={item.id} style={styles.item}>
                  <ThemedText type="smallBold">{item.description}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(`record.historyType.${item.type}`)}
                    {item.date_evenement ? ` · ${f.formatDate(item.date_evenement)}` : ''}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState text={t('record.noHistory')} />
          )}
        </Section>

        <Section title={t('record.vaccines')}>
          {data?.vaccinations.length ? (
            <Card>
              {data.vaccinations.map((vaccine) => (
                <View key={vaccine.id} style={styles.item}>
                  <ThemedText type="smallBold">{vaccine.vaccin}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {f.formatDate(vaccine.date_administration)}
                    {vaccine.lot ? ` · ${t('record.lot', { lot: vaccine.lot })}` : ''}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState text={t('record.noVaccines')} />
          )}
        </Section>

        <Section title={t('record.documents')}>
          {openError ? <Notice tone="danger">{openError}</Notice> : null}
          {data?.documents.length ? (
            data.documents.map((document) => (
              <Card key={document.id} onPress={() => open(document)} accessibilityLabel={t('record.open', { title: document.titre })}>
                <ThemedText type="smallBold">{document.titre}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`record.documentType.${document.type}`)} · {f.formatDate(document.created_at)}
                  {opening === document.id ? ` · ${t('record.opening')}` : ''}
                </ThemedText>
              </Card>
            ))
          ) : (
            <EmptyState text={t('record.noDocuments')} />
          )}
        </Section>
      </AsyncContent>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  item: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
});
