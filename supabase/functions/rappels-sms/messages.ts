// Texte des SMS de rappel. Volontairement neutre : un SMS peut être lu par
// quelqu'un d'autre, il ne doit donc jamais citer le nom du médicament.
// Soussou (sus), pular (ff) et malinké (emk) : en attente de traduction par des
// locuteurs natifs ; le français est utilisé en attendant.

type Builder = (count: number) => string;

const MESSAGES: Record<string, Builder> = {
  fr: (n) =>
    n > 1
      ? `Hilal Santé : ${n} médicaments à prendre maintenant. Ouvrez l'application pour le détail.`
      : `Hilal Santé : un médicament à prendre maintenant. Ouvrez l'application pour le détail.`,
  en: (n) =>
    n > 1
      ? `Hilal Santé: ${n} medicines to take now. Open the app for details.`
      : `Hilal Santé: one medicine to take now. Open the app for details.`,
};

export function reminderMessage(language: string, count: number): string {
  return (MESSAGES[language] ?? MESSAGES.fr)(count);
}
