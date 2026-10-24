import * as SecureStore from 'expo-secure-store';

const KEY = 'hilal.langue';

export const loadLanguage = () => SecureStore.getItemAsync(KEY).catch(() => null);
export const saveLanguage = (code: string) => SecureStore.setItemAsync(KEY, code).catch(() => {});
