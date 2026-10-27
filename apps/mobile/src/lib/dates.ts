// Dates saisies au clavier (JJ/MM/AAAA) et calculs simples sur les dates du dossier.
import { dayKey } from './format';

/** « 04/05/1990 », « 4-5-1990 » ou « 04.05.1990 » → « 1990-05-04 » ; null si la date n'existe pas. */
export function parseInputDate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** « 1990-05-04 » → « 04/05/1990 » pour pré-remplir un champ. */
export function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Jour d'aujourd'hui à l'heure de l'hôpital, « AAAA-MM-JJ ». */
export const today = () => dayKey(new Date());

/** Ajoute des jours à une date « AAAA-MM-JJ ». */
export function addDays(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Âge en années révolues à la date du jour. */
export function ageInYears(birthDate: string): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today().split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Indice de masse corporelle, arrondi à une décimale. */
export function bodyMassIndex(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}
