import { useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PAYS } from '@/constants/pays';
import { MaxContentWidth, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import i18n from '@/i18n';

// -----------------------------------------------------------------------------
// Mise en page
// -----------------------------------------------------------------------------

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  onRefresh?: () => Promise<unknown>;
  /** Respecter la zone sûre du haut (écrans sans barre de navigation). */
  edgeTop?: boolean;
}>;

/** Écran défilant, centré sur tablette, avec « tirer pour actualiser ». */
export function Screen({ title, subtitle, onRefresh, edgeTop = true, children }: ScreenProps) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;

  return (
    <SafeAreaView
      edges={edgeTop ? ['top', 'left', 'right'] : ['left', 'right']}
      style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined
        }>
        <View style={styles.content}>
          {title ? (
            <View style={styles.header}>
              <ThemedText type="subtitle" accessibilityRole="header">
                {title}
              </ThemedText>
              {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ title, action, children }: PropsWithChildren<{ title: string; action?: ReactNode }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: PropsWithChildren<{
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
}>) {
  const theme = useTheme();
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
    style,
  ];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

/** Ligne « libellé : valeur » dans une carte. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.infoValue}>
        {value}
      </ThemedText>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Actions et saisie
// -----------------------------------------------------------------------------

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, compact, accessibilityHint }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { background: theme.primary, text: theme.onPrimary, border: theme.primary },
    secondary: { background: theme.backgroundElement, text: theme.primary, border: theme.border },
    danger: { background: theme.dangerBackground, text: theme.danger, border: theme.dangerBackground },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.background, borderColor: palette.border },
        inactive && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <ThemedText type="smallBold" style={{ color: palette.text, fontSize: compact ? 14 : 16 }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function TextField({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
        {...props}
      />
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Choix parmi quelques options (puces). */
export function Chips<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" themeColor={selected ? 'primary' : 'text'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// -----------------------------------------------------------------------------
// États et messages
// -----------------------------------------------------------------------------

const toneColors: Record<'info' | 'success' | 'warning' | 'danger', [ThemeColor, ThemeColor]> = {
  info: ['backgroundSelected', 'primary'],
  success: ['successBackground', 'success'],
  warning: ['warningBackground', 'warning'],
  danger: ['dangerBackground', 'danger'],
};

export function Badge({ label, tone = 'info' }: { label: string; tone?: keyof typeof toneColors }) {
  const theme = useTheme();
  const [background, text] = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: theme[background] }]}>
      <ThemedText type="smallBold" themeColor={text} style={styles.badgeText}>
        {label}
      </ThemedText>
    </View>
  );
}

export function Notice({ tone = 'info', children }: PropsWithChildren<{ tone?: keyof typeof toneColors }>) {
  const theme = useTheme();
  const [background, text] = toneColors[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.notice, { backgroundColor: theme[background] }]}>
      <ThemedText type="small" themeColor={text}>
        {children}
      </ThemedText>
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {text}
      </ThemedText>
    </Card>
  );
}

export function LoadingView() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.loading, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} accessibilityLabel={t('common.loading')} />
    </View>
  );
}

/** Affiche « chargement », une erreur avec « réessayer », ou le contenu. */
export function AsyncContent({ loading, error, retry, children }: PropsWithChildren<{
  loading: boolean;
  error: string | null;
  retry: () => void;
}>) {
  const { t } = useTranslation();
  if (error) {
    return (
      <View style={styles.section}>
        <Notice tone="danger">{error}</Notice>
        <Button label={t('common.retry')} variant="secondary" onPress={retry} />
      </View>
    );
  }
  if (loading) return <ActivityIndicator style={styles.inlineLoader} />;
  return <>{children}</>;
}

/** Avertissement médical avec les numéros d'urgence du pays. */
export const medicalDisclaimer = () => i18n.t('common.disclaimer', PAYS.urgences);

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  button: {
    minHeight: 50,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.large,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  notice: {
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineLoader: {
    marginVertical: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
