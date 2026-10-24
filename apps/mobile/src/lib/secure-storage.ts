import * as SecureStore from 'expo-secure-store';

/**
 * Stockage de la session Supabase dans le trousseau chiffré du téléphone
 * (Keychain sur iOS, Keystore sur Android).
 *
 * SecureStore est limité à ~2 Ko par entrée alors qu'une session dépasse souvent
 * cette taille : la valeur est donc découpée en morceaux.
 */
const CHUNK_SIZE = 1800;

const countKey = (key: string) => `${key}.chunks`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function removeItem(key: string) {
  const count = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
  await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i)))
  );
  await SecureStore.deleteItemAsync(countKey(key));
}

async function getItem(key: string) {
  const count = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
  if (!count) return null;
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i)))
  );
  return chunks.some((c) => c === null) ? null : chunks.join('');
}

async function setItem(key: string, value: string) {
  await removeItem(key);
  const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [];
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
  await SecureStore.setItemAsync(countKey(key), String(chunks.length));
}

export const secureStorage = { getItem, setItem, removeItem };
