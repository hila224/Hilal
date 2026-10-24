// Mise en forme des dates dans la langue choisie, à l'heure de l'hôpital.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { PAYS } from '@/constants/pays';
import i18n from '@/i18n';

const TIME_ZONE = PAYS.fuseauHoraire;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Seuls le français et l'anglais ont des formats de date dédiés. */
const localeFor = (language: string) => (language === 'en' ? 'en-GB' : 'fr-FR');

function makeFormat(language: string) {
  const locale = localeFor(language);
  const day = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE });
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE });
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE });
  const number = new Intl.NumberFormat(locale);
  const t = i18n.getFixedT(language);

  const format = {
    locale,
    /** « Lundi 3 novembre » */
    formatDay: (iso: string | Date) => capitalize(day.format(new Date(iso))),
    /** « 3 novembre 2026 ». Accepte aussi une date seule « 2026-11-03 ». */
    formatDate: (iso: string) => date.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)),
    /** « 08:30 » */
    formatTime: (iso: string | Date) => time.format(new Date(iso)),
    /** « Lundi 3 novembre à 08:30 » */
    formatDateTime: (iso: string) => t('format.dateTime', { day: format.formatDay(iso), time: format.formatTime(iso) }),
    doctorName: (profile: { prenom: string; nom: string } | null | undefined) =>
      profile ? t('format.doctor', { name: `${profile.prenom} ${profile.nom}`.trim() }) : t('format.doctorFallback'),
    /** « 50 000 GNF » */
    formatPrice: (gnf: number) => `${number.format(gnf)} GNF`,
    /** Avertissement médical avec les numéros d'urgence du pays. */
    disclaimer: () => t('common.disclaimer', PAYS.urgences),
  };
  return format;
}

/**
 * Fonctions de mise en forme liées à la langue courante. Passer par ce hook
 * (et non par des fonctions globales) garantit que l'écran se met à jour
 * quand la langue change, y compris avec le React Compiler.
 */
export function useFormat() {
  const { i18n: instance } = useTranslation();
  const language = instance.language;
  return useMemo(() => makeFormat(language), [language]);
}

const isoDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

/** Jour calendaire à l'heure de l'hôpital, au format « 2026-11-03 », pour regrouper par jour. */
export const dayKey = (iso: string | Date) => isoDayFormatter.format(new Date(iso));
