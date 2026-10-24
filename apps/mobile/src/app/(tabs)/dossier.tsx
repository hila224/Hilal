import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Card, EmptyState, InfoRow, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { documentUrl, fetchRecord } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { DocumentType, HistoryType, MedicalDocument, Severity } from '@/lib/types';

const SEVERITY: Record<Severity, { label: string; tone: 'info' | 'warning' | 'danger' }> = {
  faible: { label: 'Faible', tone: 'info' },
  moderee: { label: 'Modérée', tone: 'warning' },
  severe: { label: 'Sévère', tone: 'danger' },
};
const HISTORY: Record<HistoryType, string> = {
  medical: 'Médical',
  chirurgical: 'Chirurgical',
  familial: 'Familial',
};
const DOCUMENT: Record<DocumentType, string> = {
  compte_rendu: 'Compte rendu',
  resultat_analyse: 'Résultat d’analyse',
  imagerie: 'Imagerie',
  ordonnance: 'Ordonnance',
  autre: 'Document',
};

export default function RecordScreen() {
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
      title="Dossier médical"
      subtitle="Renseigné par vos médecins. Signalez-leur toute erreur lors de votre prochaine consultation."
      onRefresh={refresh}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title="Informations générales">
          <Card>
            <InfoRow label="Groupe sanguin" value={medical?.groupe_sanguin ?? 'Non renseigné'} />
            <InfoRow label="Taille" value={medical?.taille_cm ? `${medical.taille_cm} cm` : 'Non renseignée'} />
            <InfoRow label="Poids" value={medical?.poids_kg ? `${Number(medical.poids_kg).toLocaleString('fr-FR')} kg` : 'Non renseigné'} />
            {medical ? (
              <ThemedText type="small" themeColor="textSecondary">
                Mis à jour le {formatDate(medical.updated_at)}
              </ThemedText>
            ) : null}
          </Card>
        </Section>

        <Section title="Allergies">
          {data?.allergies.length ? (
            data.allergies.map((allergy) => (
              <Card key={allergy.id}>
                <View style={styles.titleRow}>
                  <ThemedText type="heading" style={styles.flex}>
                    {allergy.substance}
                  </ThemedText>
                  {allergy.severite ? (
                    <Badge label={SEVERITY[allergy.severite].label} tone={SEVERITY[allergy.severite].tone} />
                  ) : null}
                </View>
                {allergy.reaction ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Réaction : {allergy.reaction}
                  </ThemedText>
                ) : null}
              </Card>
            ))
          ) : (
            <EmptyState text="Aucune allergie connue." />
          )}
        </Section>

        <Section title="Antécédents">
          {data?.antecedents.length ? (
            <Card>
              {data.antecedents.map((item) => (
                <View key={item.id} style={styles.item}>
                  <ThemedText type="smallBold">{item.description}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {HISTORY[item.type]}
                    {item.date_evenement ? ` · ${formatDate(item.date_evenement)}` : ''}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState text="Aucun antécédent renseigné." />
          )}
        </Section>

        <Section title="Vaccins">
          {data?.vaccinations.length ? (
            <Card>
              {data.vaccinations.map((vaccine) => (
                <View key={vaccine.id} style={styles.item}>
                  <ThemedText type="smallBold">{vaccine.vaccin}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(vaccine.date_administration)}
                    {vaccine.lot ? ` · lot ${vaccine.lot}` : ''}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState text="Aucun vaccin renseigné." />
          )}
        </Section>

        <Section title="Documents">
          {openError ? <Notice tone="danger">{openError}</Notice> : null}
          {data?.documents.length ? (
            data.documents.map((document) => (
              <Card key={document.id} onPress={() => open(document)} accessibilityLabel={`Ouvrir ${document.titre}`}>
                <ThemedText type="smallBold">{document.titre}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {DOCUMENT[document.type]} · {formatDate(document.created_at)}
                  {opening === document.id ? ' · ouverture…' : ''}
                </ThemedText>
              </Card>
            ))
          ) : (
            <EmptyState text="Aucun document pour le moment." />
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
