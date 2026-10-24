# Architecture — Portail patient-hôpital

> Étape 1 du plan : architecture, base de données et sécurité.
> Étape 1 validée. L'app mobile patient est faite (`apps/mobile`), le portail web est la prochaine étape.

## 1. Vue d'ensemble

```
┌──────────────────────┐      ┌───────────────────────────┐
│  App mobile PATIENT  │      │ Portail web SOIGNANTS     │
│  Expo / React Native │      │ + ADMIN (Next.js)         │
└──────────┬───────────┘      └─────────────┬─────────────┘
           │   supabase-js (clé publique + session de l'utilisateur)
           ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│ Supabase                                                 │
│  • Auth (email + mot de passe, 2FA)                      │
│  • PostgreSQL + Row Level Security  ◄── toute la sécurité│
│  • Fonctions SQL (rpc) : réserver, annuler, prendre…     │
│  • Storage privé « documents » (PDF, images)             │
│  • Edge Functions : suppression de compte, e-mails       │
└──────────────────────────────────────────────────────────┘
```

Principe : **les applications ne sont pas de confiance**. C'est la base de données qui décide
qui voit quoi (RLS). Même si quelqu'un modifie l'app, il n'obtient rien de plus.

## 2. Arborescence du monorepo

```
Hilal/
├── apps/
│   ├── mobile/              # ✅ Fait : app patient Expo (voir apps/mobile/README.md)
│   │   └── src/app/
│   │       ├── connexion, inscription, consentement
│   │       └── (tabs)/      accueil, rendez-vous, traitements, dossier, profil
│   └── web/                 # Étape suivante — Next.js App Router
│       └── app/
│           ├── (medecin)/   agenda, patients, fiche patient, ordonnance
│           ├── (secretariat)/ planning, créneaux, réservation pour un patient
│           └── (admin)/     services, médecins, comptes, journal d'audit
├── packages/
│   └── shared/              # Types générés depuis la base + schémas zod communs
├── supabase/
│   ├── migrations/          # ✅ Fait : schéma, fonctions, RLS, stockage
│   └── seed.sql             # ✅ Fait : données de démo fictives
├── tests/db/                # ✅ Fait : tests de sécurité (13 scénarios)
├── scripts/test-db.sh       # ✅ Fait : lance les tests sur un PostgreSQL local
└── docs/ARCHITECTURE.md
```

## 3. Modèle de données (inspiré de HL7 FHIR)

| Table | FHIR | Contenu |
|---|---|---|
| `profiles` | — | Compte : rôle, prénom, nom, téléphone |
| `services` | HealthcareService | Cardiologie, Pédiatrie… |
| `practitioners` | Practitioner | Médecin : service, spécialité, RPPS |
| `patients` | Patient | Identité administrative (date de naissance, sexe, consentement, langue, rappels SMS) |
| `medical_profiles` | Observation | Groupe sanguin, taille, poids |
| `care_relationships` | CareTeam | Quel médecin suit quel patient |
| `slots` | Slot | Créneaux de consultation (sans chevauchement) |
| `appointments` | Appointment | Rendez-vous : confirmé, annulé, honoré, absent |
| `allergies` | AllergyIntolerance | Substance, réaction, sévérité |
| `medical_history` | Condition | Antécédents médicaux, chirurgicaux, familiaux |
| `vaccinations` | Immunization | Vaccin, date, lot |
| `documents` | DocumentReference | Comptes rendus, analyses (fichier dans Storage) |
| `prescriptions` | MedicationRequest | Ordonnance (en-tête) |
| `prescription_items` | MedicationRequest.dosage | Médicament, dose, horaires, durée |
| `medication_intakes` | MedicationAdministration | Chaque prise prévue : à prendre / pris / non pris |
| `audit_log` | AuditEvent | Qui a lu ou modifié quoi, et quand |

```
profiles ─┬─ patients ──┬── medical_profiles, allergies, medical_history,
          │             │   vaccinations, documents
          │             ├── appointments ── slots
          │             └── prescriptions ── prescription_items ── medication_intakes
          └─ practitioners ── care_relationships ── patients
```

## 4. Qui a le droit de faire quoi

| | Patient | Médecin | Secrétariat | Admin |
|---|---|---|---|---|
| Voir son dossier médical | ✅ le sien | ✅ patients suivis | ❌ | ❌ |
| Écrire dans un dossier | ❌ | ✅ patients suivis | ❌ | ❌ |
| Prescrire | ❌ | ✅ patients suivis | ❌ | ❌ |
| Réserver un rendez-vous | ✅ pour lui | ❌ | ✅ pour un patient | ✅ |
| Annuler un rendez-vous | ✅ le sien, à venir | ❌ | ✅ | ✅ |
| Marquer honoré / absent | ❌ | ✅ ses RDV | ✅ | ✅ |
| Gérer les créneaux | ❌ | ❌ | ✅ | ✅ |
| Gérer services, médecins, rôles | ❌ | ❌ | ❌ | ✅ |
| Lire le journal d'audit | ✅ accès à son dossier | ❌ | ❌ | ✅ |
| Marquer une prise de médicament | ✅ | ❌ | ❌ | ❌ |
| Exporter ses données | ✅ | — | — | — |

**Comment un médecin obtient l'accès à un dossier :** automatiquement quand le patient prend
rendez-vous avec lui, ou manuellement par l'admin (ex. hospitalisation).

Règles importantes :
- À l'inscription, tout le monde est **patient**. Seul un admin peut changer un rôle
  (`set_user_role`), jamais le sien.
- Chaque écriture dans le dossier et chaque consultation de dossier par un soignant est
  **tracée** dans `audit_log`. Le patient peut voir qui a consulté son dossier.
- Une ligne d'ordonnance n'est jamais modifiée. Pour changer un traitement, on arrête
  l'ordonnance (les prises futures sont supprimées) et on en crée une nouvelle.
- Les fichiers sont rangés sous `documents/<id_patient>/…` et lus via des URL signées.

## 5. Actions serveur (`supabase.rpc(...)`)

| Fonction | Qui | Effet |
|---|---|---|
| `book_appointment(slot, motif, patient?)` | patient / secrétariat | Réserve un créneau libre et futur, puis donne l'accès au médecin |
| `cancel_appointment(id)` | patient / secrétariat | Annule et libère le créneau |
| `set_appointment_status(id, statut)` | médecin / secrétariat | Honoré ou absent |
| `generate_slots(médecin, du, au, de, à, durée, jours)` | secrétariat | Crée les créneaux en série |
| `record_intake(id, statut)` | patient | Pris / non pris (jusqu'à 12 h à l'avance) |
| `get_patient_record(patient)` | patient / médecin | Dossier complet en JSON (consultation tracée) |
| `export_my_data()` | patient | Export complet de ses données |
| `set_user_role(user, rôle)` | admin | Change un rôle (tracé) |

Le plan de prise est généré **automatiquement** : chaque ligne d'ordonnance crée une prise
par jour et par horaire, à l'heure de l'hôpital (`public.app_timezone()`, actuellement
Africa/Conakry). Les rappels partent en notification sur le téléphone et, si le patient l'a
activé, par SMS (voir `docs/SMS.md`).

## 6. Écrans

**App patient (mobile)**
1. Connexion / inscription / mot de passe oublié (avec choix de la langue) → consentement au premier lancement
2. Accueil : prochain rendez-vous, médicaments du jour (cases « pris »), derniers documents
3. Rendez-vous : liste → choisir un service → un médecin → un créneau → confirmer ; annuler
4. Dossier : profil médical, allergies, antécédents, vaccins, documents (ouvrir un PDF)
5. Traitements : ordonnances, plan de prise jour par jour, historique d'observance
6. Profil et paramètres : infos, notifications, qui a consulté mon dossier, exporter, supprimer mon compte

**Portail soignants (web)**
- Médecin : agenda du jour, liste de ses patients, fiche patient (dossier + ajout),
  rédaction d'une ordonnance, dépôt de document, observance du patient
- Secrétariat : planning de tous les médecins, génération de créneaux, réservation et
  annulation pour un patient, statut honoré / absent
- Admin : services, médecins, comptes et rôles, journal d'audit

## 7. Parcours principal

```
Patient s'inscrit → consent → réserve un créneau en cardiologie
      → le Dr Martin obtient l'accès au dossier
      → consultation → le médecin marque « honoré », ajoute une allergie, prescrit
      → l'app génère les rappels → le patient coche « pris »
      → le médecin voit l'observance lors du suivi
```

## 8. Tester

```bash
scripts/test-db.sh
```
Le script crée un PostgreSQL temporaire, applique les migrations, lance les 14 scénarios de
sécurité, puis charge les données de démo. Avec la CLI Supabase : `supabase db reset`.

Comptes de démo (mot de passe `Demo-Hopital-2026`) : `admin@demo.fr`, `secretariat@demo.fr`,
`dr.camara@demo.fr` (maternité), `dr.sylla@demo.fr` (médecine générale), `mariama@demo.fr`,
`mamadou@demo.fr`.

## 9. Pays : Guinée (Conakry)

L'application est réglée pour un hôpital de Conakry :
- **Heure** : Africa/Conakry (UTC+0), côté base (`public.app_timezone()`) et côté app
  (`apps/mobile/src/constants/pays.ts`). Les deux doivent rester identiques.
- **Téléphone** : mobiles guinéens uniquement, enregistrés au format `+2246XXXXXXXX`.
- **Urgences** affichées : police **117**, pompiers **18** (vérifiés en 2024). Aucun numéro
  national de SAMU n'est confirmé : l'app oriente vers les urgences de l'hôpital le plus proche.
- **Langues** : français, anglais ; soussou, pular et malinké prévus (voir
  `apps/mobile/src/i18n/guinee.ts`), affichés en français tant qu'ils ne sont pas traduits.
- **SMS** : rappels de prise via l'API SMS d'Orange Guinée (`docs/SMS.md`).
- **Loi** : loi L/2016/037/AN relative à la cybersécurité et à la protection des données à
  caractère personnel (consentement exprès, transferts hors de Guinée encadrés).

## 10. Reste à faire avant de vraies données (production)

- **Conformité à la loi L/2016/037/AN** : faire valider par un juriste guinéen le
  consentement, la politique de confidentialité, les durées de conservation, et surtout
  l'**hébergement des données hors de Guinée** (le projet Supabase est à Paris).
- **Traductions** soussou, pular et malinké par des locuteurs natifs, relues par des soignants.
- **2FA** obligatoire (Supabase Auth MFA), en priorité pour les soignants.
- Supprimer les comptes de démo (leur mot de passe est public).
- Suppression de compte via Edge Function (la clé `service_role` ne va jamais dans l'app).
- Mode hors connexion (consulter rendez-vous et traitements sans réseau).
- Interopérabilité HL7 FHIR avec les systèmes de l'hôpital ou du ministère de la Santé.
