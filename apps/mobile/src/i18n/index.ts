import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';
import fr from './fr';
import { emk, ff, sus } from './guinee';
import { loadLanguage, saveLanguage } from './storage';

export const LANGUAGES = [
  { code: 'fr', label: 'Français', translated: true },
  { code: 'en', label: 'English', translated: true },
  { code: 'sus', label: 'Soussou', translated: Object.keys(sus).length > 0 },
  { code: 'ff', label: 'Pular', translated: Object.keys(ff).length > 0 },
  { code: 'emk', label: 'Malinké', translated: Object.keys(emk).length > 0 },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const isLanguage = (code: unknown): code is LanguageCode =>
  LANGUAGES.some((language) => language.code === code);

const deviceLanguage = getLocales()[0]?.languageCode;

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    sus: { translation: sus },
    ff: { translation: ff },
    emk: { translation: emk },
  },
  lng: deviceLanguage === 'en' ? 'en' : 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

// Le choix fait dans l'app l'emporte sur la langue du téléphone.
loadLanguage().then((saved) => {
  if (isLanguage(saved) && saved !== i18n.language) i18n.changeLanguage(saved);
});

export async function setLanguage(code: LanguageCode) {
  await i18n.changeLanguage(code);
  await saveLanguage(code);
}

/** Locale pour les dates : seuls le français et l'anglais ont des formats dédiés. */
export const dateLocale = () => (i18n.language === 'en' ? 'en-GB' : 'fr-FR');

export default i18n;
