// Texte des SMS de rappel. Volontairement neutre : un SMS peut être lu par
// quelqu'un d'autre, il ne doit donc jamais citer le nom du médicament.
// Soussou (sus), pular (ff) et malinké (emk) : en attente de traduction par des
// locuteurs natifs ; le français est utilisé en attendant.

type Builder = (count: number) => string;

const MESSAGES: Record<string, Builder> = {
  fr: (n) =>
    n > 1
      ? `Hilal Santé : c'est l'heure de votre traitement (${n} médicaments). Détail dans l'application. Prenez soin de vous !`
      : `Hilal Santé : c'est l'heure de votre traitement. Détail dans l'application. Prenez soin de vous !`,
  en: (n) =>
    n > 1
      ? `Hilal Santé: time for your treatment (${n} medicines). Details in the app. Take care!`
      : `Hilal Santé: time for your treatment. Details in the app. Take care!`,
};

export function reminderMessage(language: string, count: number): string {
  return (MESSAGES[language] ?? MESSAGES.fr)(count);
}
