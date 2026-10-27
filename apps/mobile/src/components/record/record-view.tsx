// Dossier médical complet, commun au patient (son dossier) et au médecin (fiche d'un patient suivi).
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ConsultationCard } from '@/components/record/consultation-card';
import { DocumentList } from '@/components/record/document-list';
import {
  AlertsCard,
  AuthorLine,
  LastVitalsCard,
  MedicalProfileCard,
  SectionLink,
  SEVERITY_TONE,
} from '@/components/record/parts';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, Notice, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { removeRecordEntry, updateRecordEntry, type EntryKind } from '@/lib/api-record';
import { confirm } from '@/lib/confirm';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { PatientRecord, RecordAuthor } from '@/lib/types';

export type RecordLinks = {
  editProfile: () => void;
  add: (kind: EntryKind) => void;
  addDocument: () => void;
  openConsultation: (id: string) => void;
};

export function RecordView({ record, myId, links, onChanged }: {
  record: PatientRecord;
  myId: string | undefined;
  links: RecordLinks;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: EntryKind, id: string, label: string) {
    if (await confirm(t('record.removeTitle'), label, t('record.remove'))) {
      await run(id, () => removeRecordEntry(kind, id));
    }
  }

  return (
    <>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <AlertsCard record={record} />

      <Section title={t('record.general')} action={<SectionLink label={t('record.edit')} onPress={links.editProfile} />}>
        <MedicalProfileCard record={record} myId={myId} />
        <LastVitalsCard consultations={record.consultations} />
      </Section>

      <Section title={t('record.consultations')}>
        {record.consultations.length ? (
          record.consultations.map((consultation) => (
            <ConsultationCard key={consultation.id} consultation={consultation} onPress={() => links.openConsultation(consultation.id)} />
          ))
        ) : (
          <EmptyState text={t('record.noConsultations')} />
        )}
      </Section>

      <Section
        title={t('record.treatments')}
        action={<SectionLink label={t('record.add')} accessibilityLabel={t('entry.title.traitement')} onPress={() => links.add('traitement')} />}>
        {record.traitements_habituels.length ? (
          <Card>
            {record.traitements_habituels.map((item) => (
              <EntryBlock
                key={item.id}
                item={item}
                title={item.medicament}
                myId={myId}
                busy={busy === item.id}
                onRemove={() => remove('traitement', item.id, item.medicament)}
                extra={
                  item.actif ? (
                    <Button
                      compact
                      variant="secondary"
                      label={t('record.markStopped')}
                      onPress={() => run(item.id, () => updateRecordEntry('traitement', item.id, { actif: false }))}
                      disabled={busy === item.id}
                    />
                  ) : null
                }>
                <View style={styles.titleRow}>
                  <ThemedText type="smallBold" style={styles.flex}>
                    {item.medicament}
                  </ThemedText>
                  {!item.actif ? <Badge label={t('record.stopped')} /> : null}
                </View>
                {item.posologie || item.depuis ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {[item.posologie, item.depuis ? t('record.since', { date: f.formatDate(item.depuis) }) : null].filter(Boolean).join(' · ')}
                  </ThemedText>
                ) : null}
              </EntryBlock>
            ))}
          </Card>
        ) : (
          <EmptyState text={t('record.noTreatments')} />
        )}
      </Section>

      <Section
        title={t('record.history')}
        action={<SectionLink label={t('record.add')} accessibilityLabel={t('entry.title.antecedent')} onPress={() => links.add('antecedent')} />}>
        {record.antecedents.length ? (
          <Card>
            {record.antecedents.map((item) => (
              <EntryBlock key={item.id} item={item} title={item.description} myId={myId} busy={busy === item.id} onRemove={() => remove('antecedent', item.id, item.description)}>
                <View style={styles.titleRow}>
                  <ThemedText type="smallBold" style={styles.flex}>
                    {item.description}
                  </ThemedText>
                  {item.actif ? <Badge label={t('record.ongoing')} tone="warning" /> : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`record.historyType.${item.type}`)}
                  {item.date_evenement ? ` · ${f.formatDate(item.date_evenement)}` : ''}
                </ThemedText>
              </EntryBlock>
            ))}
          </Card>
        ) : (
          <EmptyState text={t('record.noHistory')} />
        )}
      </Section>

      <Section
        title={t('record.allergies')}
        action={<SectionLink label={t('record.add')} accessibilityLabel={t('entry.title.allergie')} onPress={() => links.add('allergie')} />}>
        {record.allergies.length ? (
          <Card>
            {record.allergies.map((item) => (
              <EntryBlock key={item.id} item={item} title={item.substance} myId={myId} busy={busy === item.id} onRemove={() => remove('allergie', item.id, item.substance)}>
                <View style={styles.titleRow}>
                  <ThemedText type="smallBold" style={styles.flex}>
                    {item.substance}
                  </ThemedText>
                  {item.severite ? <Badge label={t(`record.severity.${item.severite}`)} tone={SEVERITY_TONE[item.severite]} /> : null}
                </View>
                {item.reaction ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('record.reaction', { reaction: item.reaction })}
                  </ThemedText>
                ) : null}
              </EntryBlock>
            ))}
          </Card>
        ) : (
          <EmptyState text={t('record.noAllergies')} />
        )}
      </Section>

      <Section
        title={t('record.vaccines')}
        action={<SectionLink label={t('record.add')} accessibilityLabel={t('entry.title.vaccin')} onPress={() => links.add('vaccin')} />}>
        {record.vaccinations.length ? (
          <Card>
            {record.vaccinations.map((item) => (
              <EntryBlock key={item.id} item={item} title={item.vaccin} myId={myId} busy={busy === item.id} onRemove={() => remove('vaccin', item.id, item.vaccin)}>
                <ThemedText type="smallBold">{item.vaccin}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {f.formatDate(item.date_administration)}
                  {item.lot ? ` · ${t('record.lot', { lot: item.lot })}` : ''}
                </ThemedText>
              </EntryBlock>
            ))}
          </Card>
        ) : (
          <EmptyState text={t('record.noVaccines')} />
        )}
      </Section>

      <Section
        title={t('record.documents')}
        action={<SectionLink label={t('record.add')} accessibilityLabel={t('documentForm.title')} onPress={links.addDocument} />}>
        <DocumentList documents={record.documents} myId={myId} onChanged={onChanged} />
      </Section>
    </>
  );
}

/** Élément saisi dans le dossier ; son auteur peut le retirer. */
function EntryBlock({ item, title, myId, busy, onRemove, extra, children }: {
  item: RecordAuthor & { id: string };
  title: string;
  myId: string | undefined;
  busy: boolean;
  onRemove: () => void;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.entry}>
      {children ?? <ThemedText type="smallBold">{title}</ThemedText>}
      <AuthorLine item={item} myId={myId} />
      {item.created_by === myId ? (
        <View style={styles.actions}>
          {extra}
          <Button compact variant="secondary" label={t('record.remove')} onPress={onRemove} disabled={busy} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.half,
  },
});
