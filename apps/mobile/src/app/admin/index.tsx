import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AccountSection, HospitalStatusBadge, HospitalSummary } from '@/components/pro';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Card, Chips, EmptyState, InfoRow, Notice, Screen, Section, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { fetchAllHospitals, reviewHospital, type HospitalWithManagers } from '@/lib/api-pro';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { HospitalStatus } from '@/lib/types';

const FILTERS: HospitalStatus[] = ['en_attente', 'valide', 'refuse', 'suspendu'];

/** Administrateur de la plateforme : vérifie et valide les établissements. */
export default function AdminScreen() {
  const { t } = useTranslation();
  const { data, error, loading, refresh } = useData(fetchAllHospitals);
  const [filter, setFilter] = useState<HospitalStatus>('en_attente');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const hospitals = (data ?? []).filter((h) => h.statut === filter);

  return (
    <Screen title={t('admin.title')} subtitle={t('admin.subtitle')} onRefresh={refresh}>
      <Chips
        options={FILTERS.map((status) => ({
          value: status,
          label: `${t(`hospital.status.${status}`)} (${(data ?? []).filter((h) => h.statut === status).length})`,
        }))}
        value={filter}
        onChange={setFilter}
      />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {hospitals.length ? (
          hospitals.map((hospital) => (
            <HospitalReviewCard
              key={hospital.id}
              hospital={hospital}
              onDone={async (text) => {
                setMessage({ tone: 'success', text });
                await refresh();
              }}
              onError={(text) => setMessage({ tone: 'danger', text })}
            />
          ))
        ) : (
          <EmptyState text={t('admin.none')} />
        )}
      </AsyncContent>
      <Section title={t('tabs.profile')}>
        <AccountSection />
      </Section>
    </Screen>
  );
}

function HospitalReviewCard({
  hospital,
  onDone,
  onError,
}: {
  hospital: HospitalWithManagers;
  onDone: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const manager = hospital.members[0]?.profile;

  async function decide(statut: 'valide' | 'refuse' | 'suspendu') {
    if (statut !== 'valide' && reason.trim().length < 3) {
      onError(t('admin.reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await reviewHospital(hospital.id, statut, reason);
      await onDone(t(`admin.done.${statut}`, { name: hospital.nom }));
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <HospitalStatusBadge statut={hospital.statut} />
      <ThemedText type="heading">{hospital.nom}</ThemedText>
      <HospitalSummary hospital={hospital} />
      <InfoRow label={t('hospital.licence')} value={hospital.numero_agrement} />
      <InfoRow label={t('hospital.phone')} value={hospital.telephone ?? '—'} />
      <InfoRow label={t('admin.manager')} value={manager ? `${manager.prenom} ${manager.nom}` : '—'} />
      <InfoRow label={t('admin.requestedOn')} value={f.formatDate(hospital.created_at)} />
      {hospital.motif_refus ? (
        <ThemedText type="small" themeColor="danger">
          {t('hospitalSpace.reason', { reason: hospital.motif_refus })}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('admin.checkHelp')}
      </ThemedText>
      <TextField label={t('admin.reason')} value={reason} onChangeText={setReason} />
      <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
        {hospital.statut !== 'valide' ? (
          <Button compact label={t('admin.validate')} onPress={() => decide('valide')} loading={busy} />
        ) : (
          <Button compact variant="danger" label={t('admin.suspend')} onPress={() => decide('suspendu')} loading={busy} />
        )}
        {hospital.statut === 'en_attente' ? (
          <Button compact variant="danger" label={t('admin.reject')} onPress={() => decide('refuse')} loading={busy} />
        ) : null}
      </View>
    </Card>
  );
}
