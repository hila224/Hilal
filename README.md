# Hilal Santé — Plateforme de santé pour la Guinée

Plateforme qui relie les patients aux hôpitaux, cliniques et centres de santé guinéens :

- les **établissements** ouvrent leur compte, publient leurs services et leurs **tarifs** (GNF),
  enregistrent leurs **médecins** (numéro de l'Ordre obligatoire) et ouvrent des créneaux ;
- l'**administrateur** de la plateforme vérifie chaque établissement avant qu'il soit visible ;
- les **patients** prennent rendez-vous dans l'établissement de leur choix, complètent leur
  **dossier médical** (informations, allergies, antécédents, traitements, documents), suivent la
  prise de leurs médicaments, choisissent un **médecin traitant** et lui écrivent par **messagerie** ;
- les **médecins** voient leur agenda et la fiche complète de leurs patients, rédigent les
  **consultations** (examen, diagnostic, constantes) et les **ordonnances**, joignent des documents.

Une seule app (iOS, Android et web), avec un espace par type de compte.

- `apps/mobile/` : l'app (voir son README pour la lancer sur ton téléphone)
- `docs/ARCHITECTURE.md` : architecture, modèle de données, droits d'accès, comptes de démo
- `docs/SMS.md` : rappels par SMS via Orange Guinée
- `supabase/migrations/` : base de données et règles de sécurité (RLS)
- `supabase/seed.sql` : données de démonstration **fictives**
- `PROMPT_APP_SANTE.md` : le prompt et la liste de ce qu'il faut

## Tester la base de données

```bash
scripts/test-db.sh
```

Réglée pour la **Guinée (Conakry)** : heure de Conakry, numéros +224, tarifs en francs guinéens,
urgences 117 / 18, français et anglais (soussou, pular et malinké en préparation), rappels par
SMS via Orange (`docs/SMS.md`).

> ⚠️ Prototype : ne pas utiliser avec de vraies données de santé avant une validation
> juridique (loi guinéenne L/2016/037/AN) — voir `docs/ARCHITECTURE.md`, section 9.
