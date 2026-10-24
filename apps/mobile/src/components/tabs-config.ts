import type { Href } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import type { ParseKeys } from 'i18next';
import type { ComponentProps } from 'react';

import type { NativeTabs } from 'expo-router/native-tabs';

type SFSymbol = Extract<ComponentProps<typeof NativeTabs.Trigger.Icon>, { sf?: unknown }>['sf'] & string;

export type TabConfig = {
  /** Nom de la route dans le dossier de l'espace (ex. « index », « rendez-vous »). */
  name: string;
  /** Adresse complète, utilisée par la barre d'onglets web. */
  href: Href;
  label: ParseKeys;
  /** Icônes : SF Symbols (iOS) et Material Symbols (Android). */
  sf: SFSymbol;
  md: AndroidSymbol;
};

export const PATIENT_TABS = [
  { name: 'index', href: '/', label: 'tabs.home', sf: 'house.fill', md: 'home' },
  { name: 'rendez-vous', href: '/rendez-vous', label: 'tabs.appointments', sf: 'calendar', md: 'calendar_month' },
  { name: 'traitements', href: '/traitements', label: 'tabs.treatments', sf: 'pills.fill', md: 'medication' },
  { name: 'dossier', href: '/dossier', label: 'tabs.record', sf: 'folder.fill', md: 'folder_shared' },
  { name: 'profil', href: '/profil', label: 'tabs.profile', sf: 'person.crop.circle', md: 'account_circle' },
] as const satisfies readonly TabConfig[];

export const HOSPITAL_TABS = [
  { name: 'index', href: '/etablissement', label: 'tabs.dashboard', sf: 'building.2.fill', md: 'local_hospital' },
  { name: 'rendez-vous', href: '/etablissement/rendez-vous', label: 'tabs.appointments', sf: 'calendar', md: 'calendar_month' },
  { name: 'medecins', href: '/etablissement/medecins', label: 'tabs.doctors', sf: 'stethoscope', md: 'stethoscope' },
  { name: 'services', href: '/etablissement/services', label: 'tabs.servicesPrices', sf: 'list.bullet.rectangle', md: 'payments' },
  { name: 'fiche', href: '/etablissement/fiche', label: 'tabs.hospitalProfile', sf: 'gearshape.fill', md: 'settings' },
] as const satisfies readonly TabConfig[];

export const DOCTOR_TABS = [
  { name: 'index', href: '/medecin', label: 'tabs.agenda', sf: 'calendar', md: 'calendar_month' },
  { name: 'patients', href: '/medecin/patients', label: 'tabs.patients', sf: 'person.2.fill', md: 'group' },
  { name: 'messages', href: '/medecin/messages', label: 'tabs.messages', sf: 'bubble.left.and.bubble.right.fill', md: 'chat' },
  { name: 'profil', href: '/medecin/profil', label: 'tabs.profile', sf: 'person.crop.circle', md: 'account_circle' },
] as const satisfies readonly TabConfig[];
