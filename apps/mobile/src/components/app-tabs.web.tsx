import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { TabConfig } from '@/components/tabs-config';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs({ tabs }: { tabs: readonly TabConfig[] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        {/* asChild fusionne les styles : il faut un objet, pas un tableau. */}
        <View
          style={StyleSheet.flatten([
            styles.bar,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ])}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton>{t(tab.label)}</TabButton>
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...(props as PressableProps)} style={styles.button}>
      <ThemedText type="smallBold" style={styles.label} themeColor={isFocused ? 'primary' : 'textSecondary'}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    textAlign: 'center',
  },
  root: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    width: '100%',
    maxWidth: MaxContentWidth * 2,
    alignSelf: 'center',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
