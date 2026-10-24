import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Button, Card, EmptyState, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteInvitation, fetchHospitalDoctors, setDoctorActive } from '@/lib/api-pro';
import { useFormat } from '@/lib/format';
import { useHospital, useHospitalData } from '@/lib/hospital-context';
import { errorMessage } from '@/lib/supabase';

export default function HospitalDoctorsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { hospital } = useHospital();
  const { data, error, loading, refresh } = useHospitalData((h) => fetchHospitalDoctors(h.id));
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const validated = hospital?.statut === 'valide';

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen title={t('tabs.doctors')} onRefresh={refresh}>
      <ThemedText themeColor="textSecondary">{t('hospitalDoctors.intro')}</ThemedText>
      {validated ? (
        <Button label={t('hospitalDoctors.add')} onPress={() => router.push('/etablissement/medecins/ajouter')} />
      ) : (
        <Notice tone="warning">{t('hospitalDoctors.needsValidation')}</Notice>
      )}
      {actionError ? <Notice tone="danger">{actionError}</Notice> : null}

      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title={t('hospitalDoctors.list')}>
          {data?.doctors.length ? (
            data.doctors.map((doctor) => (
              <Card key={doctor.practitioner_id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
                  <ThemedText type="heading" style={{ flex: 1 }}>
                    {f.doctorName(doctor.practitioner?.profile)}
                  </ThemedText>
                  {doctor.actif ? null : <Badge label={t('hospitalDoctors.inactive')} tone="warning" />}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {doctor.practitioner?.specialite} · {doctor.service?.nom}
                </ThemedText>
                <ThemedText type="small">
                  {t('doctor.orderNumber', { number: doctor.practitioner?.numero_ordre ?? '—' })}
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
                  {doctor.actif && validated ? (
                    <Button
                      compact
                      label={t('hospitalDoctors.slots')}
                      onPress={() =>
                        router.push({ pathname: '/etablissement/medecins/creneaux', params: { medecin: doctor.practitioner_id } })
                      }
                    />
                  ) : null}
                  <Button
                    compact
                    variant="secondary"
                    label={doctor.actif ? t('hospitalDoctors.deactivate') : t('hospitalDoctors.activate')}
                    loading={busy === doctor.practitioner_id}
                    onPress={() =>
                      run(doctor.practitioner_id, () => setDoctorActive(doctor.hospital_id, doctor.practitioner_id, !doctor.actif))
                    }
                  />
                </View>
              </Card>
            ))
          ) : (
            <EmptyState text={t('hospitalDoctors.none')} />
          )}
        </Section>

        {data?.invitations.length ? (
          <Section title={t('hospitalDoctors.invitations')}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('hospitalDoctors.invitationsHelp')}
            </ThemedText>
            {data.invitations.map((invitation) => (
              <Card key={invitation.email}>
                <ThemedText type="smallBold">
                  {f.doctorName(invitation)} · {invitation.specialite}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {invitation.email} · {t('doctor.orderNumber', { number: invitation.numero_ordre })}
                </ThemedText>
                <Button
                  compact
                  variant="secondary"
                  label={t('hospitalDoctors.cancelInvitation')}
                  loading={busy === invitation.email}
                  onPress={() => hospital && run(invitation.email, () => deleteInvitation(hospital.id, invitation.email))}
                />
              </Card>
            ))}
          </Section>
        ) : null}
      </AsyncContent>
    </Screen>
  );
}
