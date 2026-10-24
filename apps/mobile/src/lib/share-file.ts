import { Share } from 'react-native';

/** Partage un export (Fichiers, e-mail, WhatsApp…) via la feuille de partage du téléphone. */
export async function shareTextFile(_fileName: string, content: string, title: string) {
  await Share.share({ message: content, title });
}
