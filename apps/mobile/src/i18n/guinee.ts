import type { Translations } from './fr';

/**
 * Soussou (sus), pular (ff) et malinké (emk).
 *
 * Ces traductions doivent être faites et relues par des locuteurs natifs,
 * idéalement des soignants : une erreur dans une consigne médicale peut être
 * dangereuse. Chaque clé absente s'affiche en français.
 *
 * Pour traduire : copier une partie de fr.ts dans l'objet de la langue,
 * en gardant les clés et les {{variables}} telles quelles. Exemple :
 *   home: { book: '…traduction…' },
 */
type PartialTranslations = { [K in keyof Translations]?: Partial<Translations[K]> };

export const sus: PartialTranslations = {};
export const ff: PartialTranslations = {};
export const emk: PartialTranslations = {};
