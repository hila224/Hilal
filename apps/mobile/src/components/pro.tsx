// Éléments communs aux espaces établissement, médecin et administrateur.
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LanguagePicker } from '@/components/language-picker';
import { SupportSection } from '@/components/support';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/lib/auth-context';
import { useFormat } from '@/lib/format';
import type { Appointment, AppointmentStatus, Hospital, HospitalStatus } from '@/lib/types';

const STATUS_TONE: Record<HospitalStatus, 'info' | 'success' | 'warning' | 'danger'> = {
  en_attente: 'warning',
  valide: 'success',
  refuse: 'danger',
  suspendu: 'danger',
};

export function HospitalStatusBadge({ statut }: { statut: HospitalStatus }) {
  const { t } = useTranslation();
  return <Badge label={t(`hospital.status.${statut}`)} tone={STATUS_TONE[statut]} />;
}

/** Résumé d'un établissement : type, adresse, horaires, paiements acceptés. */
export function HospitalSummary({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation();
  const place = [hospital.commune, hospital.ville].filter(Boolean).join(', ');
  return (
    <View style={{ gap: Spacing.half }}>
      <ThemedText type="small" themeColor="textSecondary">
        {t(`hospital.type.${hospital.type}`)} · {place}
      </ThemedText>
      {hospital.adresse ? <ThemedText type="small">{hospital.adresse}</ThemedText> : null}
      {hospital.horaires ? (
        <ThemedText type="small">
          {t('hospital.hours')} : {hospital.horaires}
        </ThemedText>
      ) : null}
      {hospital.urgences_24h ? <Badge label={t('hospital.emergency24')} tone="danger" /> : null}
      {hospital.paiements.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('hospital.payments')} : {hospital.paiements.map((p) => t(`hospital.payment.${p}`)).join(', ')}
        </ThemedText>
      ) : null}
    </View>
  );
}

const APPOINTMENT_TONE: Record<AppointmentStatus, 'info' | 'success' | 'warning' | 'danger'> = {
  confirme: 'info',
  honore: 'success',
  absent: 'warning',
  annule: 'danger',
};

/** Rendez-vous vu par un médecin ou un établissement, avec les actions possibles. */
export function ProAppointmentCard({
  appointment,
  showHospital,
  showDoctor,
  busy,
  onCancel,
  onStatus,
  onOpenRecord,
  onConsult,
}: {
  appointment: Appointment;
  showHospital?: boolean;
  showDoctor?: boolean;
  busy?: boolean;
  onCancel?: () => void;
  onStatus?: (statut: 'honore' | 'absent') => void;
  /** Médecin : ouvrir le dossier du patient. */
  onOpenRecord?: () => void;
  /** Médecin : rédiger la consultation de ce rendez-vous. */
  onConsult?: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow();
  const started = Date.parse(appointment.slot.debut) <= now;
  const patient = appointment.patient?.profile;
  return (
    <Card>
      <Badge label={t(`appointments.status.${appointment.statut}`)} tone={APPOINTMENT_TONE[appointment.statut]} />
      <ThemedText type="heading">{f.formatDateTime(appointment.slot.debut)}</ThemedText>
      <ThemedText>{patient ? `${patient.prenom} ${patient.nom}` : '—'}</ThemedText>
      {patient?.telephone ? (
        <ThemedText type="small" themeColor="textSecondary">
          {patient.telephone}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {[
          showDoctor ? f.doctorName(appointment.practitioner?.profile) : null,
          showHospital ? appointment.hospital?.nom : null,
          appointment.motif,
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
      {onOpenRecord || onConsult ? (
        <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
          {onConsult && appointment.statut !== 'annule' && appointment.statut !== 'absent' && Date.parse(appointment.slot.debut) <= now + 60 * 60 * 1000 ? (
            <Button compact label={t('doctorSpace.consult')} onPress={onConsult} disabled={busy} />
          ) : null}
          {onOpenRecord ? <Button compact variant="secondary" label={t('doctorSpace.openRecord')} onPress={onOpenRecord} /> : null}
        </View>
      ) : null}
      {appointment.statut === 'confirme' ? (
        <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
          {started && onStatus ? (
            <>
              <Button compact label={t('appointments.markDone')} onPress={() => onStatus('honore')} disabled={busy} />
              <Button compact variant="secondary" label={t('appointments.markMissed')} onPress={() => onStatus('absent')} disabled={busy} />
            </>
          ) : null}
          {!started && onCancel ? (
            <Button compact variant="danger" label={t('appointments.cancel')} onPress={onCancel} disabled={busy} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Langue, déconnexion et avertissement, en bas des écrans de profil professionnels. */
export function AccountSection() {
  const { t } = useTranslation();
  const f = useFormat();
  const { session, signOut } = useAuth();
  return (
    <>
      <Section title={t('language.title')}>
        <LanguagePicker />
      </Section>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {t('profile.email')} : {session?.user.email}
        </ThemedText>
      </Card>
      <SupportSection />
      <Button label={t('profile.signOut')} variant="danger" onPress={signOut} />
      <ThemedText type="small" themeColor="textSecondary">
        {f.disclaimer()}
      </ThemedText>
    </>
  );
}
