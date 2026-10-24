import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LanguagePicker } from '@/components/language-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { useFormat } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';

const POINTS = ['kept', 'why', 'who', 'trace', 'rights'] as const;

export default function ConsentScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { session, reload, signOut } = useAuth();
  const [healthData, setHealthData] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function accept() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('patients')
      .update({ consentement_rgpd_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (updateError) {
      setError(errorMessage(updateError));
      setSubmitting(false);
      return;
    }
    await reload();
  }

  return (
    <Screen title={t('consent.title')} subtitle={t('consent.subtitle')}>
      <LanguagePicker />
      <Card>
        {POINTS.map((point) => (
          <View key={point} style={styles.point}>
            <ThemedText type="smallBold">{t(`consent.${point}Title`)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t(`consent.${point}Text`)}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Notice tone="warning">{f.disclaimer()}</Notice>

      <View style={styles.checks}>
        <Checkbox
          checked={healthData}
          onChange={setHealthData}
          label={t('consent.acceptHealth')}
        />
        <Checkbox
          checked={terms}
          onChange={setTerms}
          label={t('consent.acceptTerms')}
        />
      </View>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button label={t('consent.continue')} onPress={accept} disabled={!healthData || !terms} loading={submitting} />
      <Button label={t('consent.refuse')} variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.checkRow}>
      <View
        style={[
          styles.box,
          { borderColor: checked ? theme.primary : theme.border, backgroundColor: checked ? theme.primary : theme.backgroundElement },
        ]}>
        {checked ? <ThemedText style={{ color: theme.onPrimary, lineHeight: 20 }}>✓</ThemedText> : null}
      </View>
      <ThemedText type="small" style={styles.checkLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  point: {
    gap: Spacing.half,
    marginBottom: Spacing.two,
  },
  checks: {
    gap: Spacing.three,
  },
  checkRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: Radius.small,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
  },
});
