import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui';
import { useFormat } from '@/lib/format';
import type { Appointment, AppointmentStatus } from '@/lib/types';

const TONE: Record<AppointmentStatus, 'info' | 'success' | 'warning' | 'danger'> = {
  confirme: 'info',
  honore: 'success',
  absent: 'warning',
  annule: 'danger',
};

export function AppointmentCard({ appointment, children }: { appointment: Appointment; children?: React.ReactNode }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <Card>
      <Badge label={t(`appointments.status.${appointment.statut}`)} tone={TONE[appointment.statut]} />
      <ThemedText type="heading">{f.formatDateTime(appointment.slot.debut)}</ThemedText>
      <View>
        <ThemedText>{f.doctorName(appointment.practitioner?.profile)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[appointment.practitioner?.specialite, appointment.practitioner?.service?.nom].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      {appointment.motif ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('appointments.reason', { reason: appointment.motif })}
        </ThemedText>
      ) : null}
      {children}
    </Card>
  );
}
