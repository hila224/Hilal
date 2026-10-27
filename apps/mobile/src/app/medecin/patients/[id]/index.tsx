import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { PrescriptionCard } from '@/components/record/prescription-card';
import { RecordView } from '@/components/record/record-view';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Button, Card, EmptyState, InfoRow, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useNow } from '@/hooks/use-now';
import { fetchRecord } from '@/lib/api';
import { stopPrescription } from '@/lib/api-record';
import { useAuth } from '@/lib/auth-context';
import { confirm } from '@/lib/confirm';
import { ageInYears } from '@/lib/dates';
import { useFormat } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { errorMessage } from '@/lib/supabase';
import type { PatientRecord } from '@/lib/types';

/**
 * Fiche complète d'un patient suivi : identité, alertes, consultations, ordonnances,
 * observance. Chaque ouverture est tracée et visible par le patient.
 */
export default function DoctorPatientRecordScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refresh } = useData(() => fetchRecord(id));
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const myId = session?.user.id;

  const go = (screen: 'consultation' | 'ordonnance' | 'ajouter' | 'document' | 'profil-medical' | 'compte-rendu', params: Record<string, string> = {}) =>
    router.push({ pathname: `/medecin/patients/[id]/${screen}`, params: { id, ...params } });

  async function stop(prescriptionId: string) {
    if (!(await confirm(t('doctorSpace.stopTitle'), t('doctorSpace.stopText'), t('doctorSpace.stop')))) return;
    setBusy(prescriptionId);
    setActionError(null);
    try {
      await stopPrescription(prescriptionId);
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <Notice tone="info">{t('doctorSpace.traced')}</Notice>
      {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {data ? (
          <>
            <PatientHeader record={data} />
            <View style={styles.actions}>
              <Button compact label={t('doctorSpace.newConsultation')} onPress={() => go('consultation')} />
              <Button compact variant="secondary" label={t('doctorSpace.newPrescription')} onPress={() => go('ordonnance')} />
              <Button
                compact
                variant="secondary"
                label={t('doctorSpace.writeToPatient')}
                onPress={() => myId && router.push({ pathname: '/conversation', params: { patient: id, medecin: myId } })}
              />
            </View>

            <RecordView
              record={data}
              myId={myId}
              onChanged={refresh}
              links={{
                editProfile: () => go('profil-medical'),
                add: (kind) => go('ajouter', { type: kind }),
                addDocument: () => go('document'),
                openConsultation: (cid) => go('compte-rendu', { cid }),
              }}
            />

            <Section title={t('treatments.prescriptions')}>
              <AdherenceCard observance={data.observance} />
              {data.ordonnances.length ? (
                data.ordonnances.map((prescription) => (
                  <PrescriptionCard
                    key={prescription.id}
                    prescription={prescription}
                    busy={busy === prescription.id}
                    onStop={prescription.practitioner_id === myId ? () => stop(prescription.id) : undefined}
                  />
                ))
              ) : (
                <EmptyState text={t('treatments.noPrescriptions')} />
              )}
            </Section>

            <AppointmentsSection record={data} onConsult={(rdv) => go('consultation', { rdv })} onReport={(cid) => go('compte-rendu', { cid })} />
          </>
        ) : null}
      </AsyncContent>
    </Screen>
  );
}

/** Identité, coordonnées, personne à prévenir et assurance. */
function PatientHeader({ record }: { record: PatientRecord }) {
  const { t } = useTranslation();
  const f = useFormat();
  const identity = record.identite;
  if (!identity) return null;
  const summary = [
    identity.date_naissance ? `${t('doctorSpace.age', { count: ageInYears(identity.date_naissance) })} (${f.formatDate(identity.date_naissance)})` : null,
    identity.sexe ? t(`myInfo.sexValue.${identity.sexe}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const address = [identity.adresse, identity.commune, identity.ville].filter(Boolean).join(', ');
  const emergency = identity.contact_urgence_nom
    ? [identity.contact_urgence_nom, identity.contact_urgence_lien ? `(${identity.contact_urgence_lien})` : null, identity.contact_urgence_tel ? `+224 ${formatPhone(identity.contact_urgence_tel)}` : null]
        .filter(Boolean)
        .join(' ')
    : null;
  const insurance = [identity.assurance, identity.numero_assurance].filter(Boolean).join(' · ');

  return (
    <Card>
      <ThemedText type="subtitle">
        {identity.prenom} {identity.nom}
      </ThemedText>
      {summary ? <ThemedText themeColor="textSecondary">{summary}</ThemedText> : null}
      {identity.telephone ? (
        <View style={styles.phoneRow}>
          <ThemedText style={styles.flex}>+224 {formatPhone(identity.telephone)}</ThemedText>
          <Button compact variant="secondary" label={t('doctorSpace.call')} onPress={() => Linking.openURL(`tel:${identity.telephone}`)} />
        </View>
      ) : null}
      {address ? <InfoRow label={t('doctorSpace.address')} value={address} /> : null}
      {identity.profession ? <InfoRow label={t('doctorSpace.profession')} value={identity.profession} /> : null}
      {identity.situation_familiale ? (
        <InfoRow label={t('doctorSpace.maritalStatus')} value={t(`myInfo.marital.${identity.situation_familiale}`)} />
      ) : null}
      <InfoRow label={t('doctorSpace.emergencyContact')} value={emergency ?? t('common.notProvidedF')} />
      {insurance ? <InfoRow label={t('doctorSpace.insurance')} value={insurance} /> : null}
      {identity.medecin_traitant ? (
        <InfoRow label={t('doctorSpace.treatingDoctor')} value={f.doctorName(identity.medecin_traitant)} />
      ) : null}
      {identity.contact_urgence_tel ? (
        <Button
          compact
          variant="secondary"
          label={`${t('doctorSpace.call')} : ${identity.contact_urgence_nom ?? t('doctorSpace.emergencyContact')}`}
          onPress={() => Linking.openURL(`tel:${identity.contact_urgence_tel}`)}
        />
      ) : null}
    </Card>
  );
}

/** Prises cochées par le patient sur les 30 derniers jours. */
function AdherenceCard({ observance }: { observance: PatientRecord['observance'] }) {
  const { t } = useTranslation();
  const total = observance?.prevues ?? 0;
  const percent = total ? Math.round((observance.prises / total) * 100) : 0;
  return (
    <Card>
      <ThemedText type="smallBold">{t('doctorSpace.adherence')}</ThemedText>
      {total ? (
        <>
          <View style={styles.phoneRow}>
            <ThemedText type="heading" style={styles.flex}>
              {t('doctorSpace.adherenceValue', { taken: observance.prises, total, percent })}
            </ThemedText>
            <Badge label={`${percent} %`} tone={percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'danger'} />
          </View>
          {observance.non_prises ? (
            <ThemedText type="small" themeColor="warning">
              {t('doctorSpace.adherenceMissed', { count: observance.non_prises })}
            </ThemedText>
          ) : null}
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('doctorSpace.noAdherence')}
        </ThemedText>
      )}
    </Card>
  );
}

const APPOINTMENT_TONE = { confirme: 'info', honore: 'success', absent: 'warning', annule: 'danger' } as const;

/** Rendez-vous de ce patient avec le médecin connecté, avec accès au compte rendu. */
function AppointmentsSection({ record, onConsult, onReport }: {
  record: PatientRecord;
  onConsult: (appointmentId: string) => void;
  onReport: (consultationId: string) => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow();
  return (
    <Section title={t('doctorSpace.appointments')}>
      {record.rendez_vous.length ? (
        record.rendez_vous.map((appointment) => (
          <Card key={appointment.id}>
            <Badge label={t(`appointments.status.${appointment.statut}`)} tone={APPOINTMENT_TONE[appointment.statut]} />
            <ThemedText type="smallBold">{f.formatDateTime(appointment.debut)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[appointment.etablissement, appointment.motif].filter(Boolean).join(' · ')}
            </ThemedText>
            {appointment.consultation_id ? (
              <Button compact variant="secondary" label={t('doctorSpace.seeReport')} onPress={() => onReport(appointment.consultation_id!)} />
            ) : appointment.statut !== 'annule' && Date.parse(appointment.debut) <= now + 60 * 60 * 1000 ? (
              <Button compact label={t('doctorSpace.consult')} onPress={() => onConsult(appointment.id)} />
            ) : null}
          </Card>
        ))
      ) : (
        <EmptyState text={t('doctorSpace.noAppointments')} />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
