import { Alert, Platform } from 'react-native';

import i18n from '@/i18n';

/** Demande confirmation avant une action irréversible (Alert n'existe pas sur le web). */
export function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: i18n.t('common.back'), style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ])
  );
}
