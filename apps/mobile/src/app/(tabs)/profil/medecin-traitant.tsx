import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Button, Card, EmptyState, Notice, Screen, TextField } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchDoctorChoices, setMedecinTraitant } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { confirm } from '@/lib/confirm';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { DoctorChoice } from '@/lib/api';

/** Choix du médecin traitant parmi les médecins des établissements validés. */
export default function TreatingDoctorScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { patient, reload } = useAuth();
  const { data, error, loading, refresh } = useData(fetchDoctorChoices);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function choose(doctor: DoctorChoice | null) {
    if (doctor) {
      const ok = await confirm(
        t('treatingDoctor.confirmTitle'),
        t('treatingDoctor.confirmText', { doctor: f.doctorName(doctor.profile) }),
        t('treatingDoctor.confirmAction')
      );
      if (!ok) return;
    }
    setSaving(doctor?.id ?? 'none');
    setActionError(null);
    try {
      await setMedecinTraitant(doctor?.id ?? null);
      await reload();
      router.back();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  const query = search.trim().toLowerCase();
  const doctors = (data ?? []).filter((d) =>
    !query ||
    `${d.profile?.prenom} ${d.profile?.nom} ${d.specialite} ${d.hospitals.join(' ')}`.toLowerCase().includes(query)
  );

  return (
    <Screen edgeTop={false} onRefresh={refresh}>
      <ThemedText themeColor="textSecondary">{t('treatingDoctor.intro')}</ThemedText>
      {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
      <TextField label={t('treatingDoctor.search')} value={search} onChangeText={setSearch} placeholder={t('treatingDoctor.searchPlaceholder')} />
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {doctors.length ? (
          doctors.map((doctor) => {
            const current = patient?.medecin_traitant_id === doctor.id;
            return (
              <Card key={doctor.id}>
                <ThemedText type="heading">{f.doctorName(doctor.profile)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {doctor.specialite} · {doctor.hospitals.join(', ')}
                </ThemedText>
                <ThemedText type="small" themeColor="success">
                  ✓ {t('doctor.verified', { number: doctor.numero_ordre ?? '—' })}
                </ThemedText>
                {doctor.followsMe ? <Badge label={t('treatingDoctor.followsMe')} tone="info" /> : null}
                {current ? (
                  <Badge label={t('treatingDoctor.current')} tone="success" />
                ) : (
                  <Button compact label={t('treatingDoctor.choose')} onPress={() => choose(doctor)} loading={saving === doctor.id} />
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState text={t('treatingDoctor.none')} />
        )}
      </AsyncContent>
      {patient?.medecin_traitant_id ? (
        <Button variant="secondary" label={t('treatingDoctor.remove')} onPress={() => choose(null)} loading={saving === 'none'} />
      ) : null}
    </Screen>
  );
}
