import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui';
import { doctorName, formatDateTime } from '@/lib/format';
import type { Appointment, AppointmentStatus } from '@/lib/types';

const STATUS: Record<AppointmentStatus, { label: string; tone: 'info' | 'success' | 'warning' | 'danger' }> = {
  confirme: { label: 'Confirmé', tone: 'info' },
  honore: { label: 'Effectué', tone: 'success' },
  absent: { label: 'Absent', tone: 'warning' },
  annule: { label: 'Annulé', tone: 'danger' },
};

export function AppointmentCard({ appointment, children }: { appointment: Appointment; children?: React.ReactNode }) {
  const status = STATUS[appointment.statut];
  return (
    <Card>
      <Badge label={status.label} tone={status.tone} />
      <ThemedText type="heading">{formatDateTime(appointment.slot.debut)}</ThemedText>
      <View>
        <ThemedText>{doctorName(appointment.practitioner?.profile)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[appointment.practitioner?.specialite, appointment.practitioner?.service?.nom].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      {appointment.motif ? (
        <ThemedText type="small" themeColor="textSecondary">
          Motif : {appointment.motif}
        </ThemedText>
      ) : null}
      {children}
    </Card>
  );
}
