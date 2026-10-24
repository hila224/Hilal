import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, MEDICAL_DISCLAIMER, Notice, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { errorMessage, supabase } from '@/lib/supabase';

const POINTS = [
  ['Ce que nous conservons', 'Votre identité, vos rendez-vous, votre dossier médical (allergies, antécédents, vaccins, documents), vos ordonnances et le suivi de vos prises de médicaments.'],
  ['Pourquoi', 'Organiser vos soins à l’hôpital et vous permettre de les suivre. Vos données ne sont jamais vendues ni utilisées à des fins publicitaires.'],
  ['Qui y a accès', 'Vous, et uniquement les médecins avec qui vous avez pris rendez-vous. Le secrétariat voit vos rendez-vous, jamais votre contenu médical.'],
  ['Traçabilité', 'Chaque consultation de votre dossier par un soignant est enregistrée. Vous pouvez voir qui l’a consulté dans votre profil.'],
  ['Vos droits', 'Vous pouvez à tout moment télécharger toutes vos données depuis votre profil, et demander la suppression de votre compte au délégué à la protection des données de l’hôpital.'],
] as const;

export default function ConsentScreen() {
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
    <Screen title="Vos données de santé" subtitle="Avant de commencer, voici comment nous protégeons vos informations.">
      <Card>
        {POINTS.map(([title, text]) => (
          <View key={title} style={styles.point}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {text}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Notice tone="warning">{MEDICAL_DISCLAIMER}</Notice>

      <View style={styles.checks}>
        <Checkbox
          checked={healthData}
          onChange={setHealthData}
          label="J’accepte que mes données de santé soient traitées pour l’organisation de mes soins."
        />
        <Checkbox
          checked={terms}
          onChange={setTerms}
          label="J’ai lu la politique de confidentialité et les conditions d’utilisation."
        />
      </View>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button label="Continuer" onPress={accept} disabled={!healthData || !terms} loading={submitting} />
      <Button label="Refuser et me déconnecter" variant="secondary" onPress={signOut} />
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
