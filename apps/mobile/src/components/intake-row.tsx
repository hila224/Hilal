import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { recordIntake } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { MedicationIntake } from '@/lib/types';

// Comme côté serveur : on peut cocher une prise jusqu'à 12 h à l'avance.
const ADVANCE_MS = 12 * 60 * 60 * 1000;

/** Une prise de médicament avec les boutons « Pris » / « Pas pris ». */
export function IntakeRow({ intake, onChange }: { intake: MedicationIntake; onChange: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [saving, setSaving] = useState<'pris' | 'non_pris' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const actionable = Date.parse(intake.prevu_a) - now <= ADVANCE_MS;
  const name = intake.item?.medicament ?? t('intake.medicine');

  async function save(statut: 'pris' | 'non_pris') {
    setSaving(statut);
    setError(null);
    try {
      await recordIntake(intake.id, statut);
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <ThemedText type="heading" style={styles.time}>
          {f.formatTime(intake.prevu_a)}
        </ThemedText>
        <View style={styles.info}>
          <ThemedText type="smallBold">{name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {intake.item?.dosage}
            {intake.item?.instructions ? ` · ${intake.item.instructions}` : ''}
          </ThemedText>
        </View>
        {/* Si les boutons sont affichés, ils indiquent déjà l'état. */}
        {!actionable && intake.statut === 'pris' ? <Badge label={t('intake.takenDone')} tone="success" /> : null}
        {!actionable && intake.statut === 'non_pris' ? <Badge label={t('intake.notTaken')} tone="warning" /> : null}
      </View>
      {actionable ? (
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              compact
              label={intake.statut === 'pris' ? t('intake.takenDone') : t('intake.taken')}
              variant={intake.statut === 'pris' ? 'primary' : 'secondary'}
              loading={saving === 'pris'}
              disabled={!!saving}
              onPress={() => save('pris')}
              accessibilityHint={t('intake.takenHint', { name })}
            />
          </View>
          <View style={styles.action}>
            <Button
              compact
              label={intake.statut === 'non_pris' ? t('intake.notTakenDone') : t('intake.notTaken')}
              variant={intake.statut === 'non_pris' ? 'primary' : 'secondary'}
              loading={saving === 'non_pris'}
              disabled={!!saving}
              onPress={() => save('non_pris')}
            />
          </View>
        </View>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  time: {
    minWidth: 56,
  },
  info: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
});
