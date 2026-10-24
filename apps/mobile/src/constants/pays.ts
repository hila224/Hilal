// Réglages propres au pays de l'hôpital : à adapter pour un autre pays.
// Le fuseau horaire doit rester identique à public.app_timezone() côté base.
export const PAYS = {
  nom: 'Guinée',
  fuseauHoraire: 'Africa/Conakry',
  indicatif: '+224',
  // Numéros vérifiés en 2024 (Guinee360, ambassade de France). Il n'existe pas de
  // numéro national de SAMU confirmé : on oriente vers les urgences de l'hôpital.
  urgences: {
    police: '117',
    pompiers: '18',
  },
} as const;
