import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS = [
  { name: 'index', href: '/', label: 'Accueil' },
  { name: 'rendez-vous', href: '/rendez-vous', label: 'Rendez-vous' },
  { name: 'traitements', href: '/traitements', label: 'Traitements' },
  { name: 'dossier', href: '/dossier', label: 'Dossier' },
  { name: 'profil', href: '/profil', label: 'Profil' },
] as const;

export default function AppTabs() {
  const theme = useTheme();
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
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton>{tab.label}</TabButton>
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
