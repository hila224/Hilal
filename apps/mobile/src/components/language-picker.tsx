import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chips } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { LANGUAGES, isLanguage, setLanguage, type LanguageCode } from '@/i18n';

/** Choix de la langue. `onChange` est appelé après le changement (ex. pour l'enregistrer côté serveur). */
export function LanguagePicker({ onChange }: { onChange?: (code: LanguageCode) => void }) {
  const { t, i18n } = useTranslation();
  const current = isLanguage(i18n.language) ? i18n.language : 'fr';
  const translated = LANGUAGES.find((language) => language.code === current)?.translated ?? true;

  return (
    <View style={{ gap: Spacing.two }}>
      <Chips
        options={LANGUAGES.map((language) => ({ value: language.code, label: language.label }))}
        value={current}
        onChange={async (code) => {
          await setLanguage(code);
          onChange?.(code);
        }}
      />
      {translated ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('language.pending')}
        </ThemedText>
      )}
    </View>
  );
}
