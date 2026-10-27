// « Besoin d'aide ? » : coordonnées de l'équipe Hilal Santé, présentes dans chaque espace.
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Section } from '@/components/ui';
import { PAYS } from '@/constants/pays';
import { SUPPORT } from '@/constants/support';
import { Spacing } from '@/constants/theme';

function writeEmail(subject: string) {
  Linking.openURL(`mailto:${SUPPORT.email}?subject=${encodeURIComponent(subject)}`);
}
const call = () => Linking.openURL(`tel:${SUPPORT.telephone}`);

/** Carte complète, en bas des écrans de profil. */
export function SupportSection() {
  const { t } = useTranslation();
  return (
    <Section title={t('support.title')}>
      <Card>
        <ThemedText>{t('support.text')}</ThemedText>
        <View style={styles.buttons}>
          <Button compact label={t('support.email')} onPress={() => writeEmail(t('support.mailSubject'))} />
          <Button compact variant="secondary" label={t('support.call')} onPress={call} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {SUPPORT.email} · {SUPPORT.telephoneAffiche}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('support.notMedical', PAYS.urgences)}
        </ThemedText>
      </Card>
    </Section>
  );
}

/** Version courte, sur les écrans de connexion. */
export function SupportLine() {
  const { t } = useTranslation();
  return (
    <View style={styles.line}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {t('support.short')}
      </ThemedText>
      <View style={styles.links}>
        <Pressable accessibilityRole="link" onPress={() => writeEmail(t('support.mailSubject'))} hitSlop={6}>
          <ThemedText type="link" style={styles.small}>
            {SUPPORT.email}
          </ThemedText>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={call} hitSlop={6}>
          <ThemedText type="link" style={styles.small}>
            {SUPPORT.telephoneAffiche}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  line: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  small: {
    fontSize: 14,
  },
  center: {
    textAlign: 'center',
  },
});
