import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { useFormat } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { Practitioner } from '@/lib/types';

/** Médecin traitant du patient, avec l'accès à la messagerie. */
export function TreatingDoctorSection() {
  const { t } = useTranslation();
  const f = useFormat();
  const { session, patient } = useAuth();
  const doctorId = patient?.medecin_traitant_id ?? null;
  const { data } = useData(async () => {
    if (!doctorId) return null;
    const rows = unwrap<Practitioner[]>(
      await supabase.from('practitioners').select('id, specialite, numero_ordre, profile:profiles(prenom, nom)').eq('id', doctorId)
    );
    return rows[0] ?? null;
  });
  const doctor = data && data.id === doctorId ? data : null;

  return (
    <Section title={t('treatingDoctor.title')}>
      <Card>
        {doctor ? (
          <>
            <ThemedText type="heading">{f.doctorName(doctor.profile)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {doctor.specialite}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('treatingDoctor.noneChosen')}
          </ThemedText>
        )}
        <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
          {doctorId && session ? (
            <Button
              compact
              label={t('treatingDoctor.message')}
              onPress={() => router.push({ pathname: '/conversation', params: { patient: session.user.id, medecin: doctorId } })}
            />
          ) : null}
          <Button
            compact
            variant="secondary"
            label={doctorId ? t('treatingDoctor.change') : t('treatingDoctor.chooseOne')}
            onPress={() => router.push('/profil/medecin-traitant')}
          />
        </View>
      </Card>
      <Card onPress={() => router.push('/profil/messages')} accessibilityLabel={t('messages.title')}>
        <ThemedText type="smallBold">{t('messages.title')} ›</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('messages.patientIntro')}
        </ThemedText>
      </Card>
    </Section>
  );
}
