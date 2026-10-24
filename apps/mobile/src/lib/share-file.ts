import { Share } from 'react-native';

/** Partage un export (Fichiers, e-mail, AirDrop…) via la feuille de partage du téléphone. */
export async function shareTextFile(_fileName: string, content: string) {
  await Share.share({ message: content, title: 'Mes données de santé' });
}
