// Mise en forme des dates en français, à l'heure de Paris (heure de l'hôpital).
const TIME_ZONE = 'Europe/Paris';

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
});
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
const isoDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** « Lundi 3 novembre » */
export const formatDay = (iso: string | Date) => capitalize(dayFormatter.format(new Date(iso)));

/** « 3 novembre 2026 ». Accepte aussi une date seule « 2026-11-03 ». */
export const formatDate = (iso: string) =>
  dateFormatter.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));

/** « 08:30 » */
export const formatTime = (iso: string | Date) => timeFormatter.format(new Date(iso));

/** « Lundi 3 novembre à 08:30 » */
export const formatDateTime = (iso: string) => `${formatDay(iso)} à ${formatTime(iso)}`;

/** Jour calendaire à Paris, au format « 2026-11-03 », pour regrouper par jour. */
export const dayKey = (iso: string | Date) => isoDayFormatter.format(new Date(iso));

export const doctorName = (profile: { prenom: string; nom: string } | null | undefined) =>
  profile ? `Dr ${profile.prenom} ${profile.nom}`.trim() : 'Médecin';
