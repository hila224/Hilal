# Architecture — Hilal Santé, plateforme de santé pour la Guinée

Hilal Santé met en relation les **patients** et les **établissements de santé** guinéens
(hôpitaux, cliniques, centres de santé, cabinets) :

- les établissements ouvrent leur compte, publient leurs services et leurs **tarifs** (en GNF),
  enregistrent leurs **médecins** et ouvrent des créneaux ;
- l'**administrateur de la plateforme** vérifie chaque établissement (numéro d'agrément) avant
  qu'il soit visible ; chaque établissement **se porte garant** de ses médecins (numéro
  d'inscription à l'Ordre des médecins obligatoire) ;
- le patient choisit l'**établissement** où se tient son rendez-vous, puis le service, le médecin
  et le créneau ; il suit ses traitements, choisit un **médecin traitant** et lui écrit par
  **messagerie**.

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│  App Hilal Santé (Expo : iOS, Android et web)                 │
│  Un espace par type de compte :                               │
│   patient · médecin · établissement · administrateur          │
└──────────────────────────────┬───────────────────────────────┘
                               │ supabase-js (clé publique + session)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Supabase                                                      │
│  • Auth (e-mail + mot de passe)                               │
│  • PostgreSQL + Row Level Security   ◄── toute la sécurité    │
│  • Fonctions SQL (rpc) : réserver, enregistrer un médecin…    │
│  • Storage privé « documents »                                │
│  • Edge Function « rappels-sms » → API SMS d'Orange Guinée    │
└──────────────────────────────────────────────────────────────┘
```

Principe : **l'application n'est pas de confiance**. C'est la base de données qui décide
qui voit quoi (RLS). Même si quelqu'un modifie l'app, il n'obtient rien de plus.

## 2. Arborescence

```
Hilal/
├── apps/mobile/                 App Expo (voir apps/mobile/README.md)
│   └── src/app/
│       ├── connexion, inscription, inscription-etablissement, consentement
│       ├── (tabs)/              Patient : accueil, rendez-vous, traitements, dossier, profil
│       ├── etablissement/       Établissement : accueil, rendez-vous, médecins, tarifs, fiche
│       ├── medecin/             Médecin : agenda, patients, messages, profil
│       ├── admin/               Administrateur : validation des établissements
│       └── conversation.tsx     Messagerie patient ↔ médecin
├── supabase/
│   ├── migrations/              Schéma, fonctions, RLS, stockage, Guinée, plateforme
│   ├── functions/rappels-sms/   Envoi des rappels par SMS
│   └── seed.sql                 Données de démo fictives
├── tests/db/                    Tests de sécurité (23 scénarios)
├── scripts/test-db.sh           Lance les tests sur un PostgreSQL local
└── docs/                        Architecture, SMS, captures
```

## 3. Modèle de données (inspiré de HL7 FHIR)

| Table | FHIR | Contenu |
|---|---|---|
| `profiles` | — | Compte : rôle, prénom, nom, téléphone |
| `hospitals` | Organization | Établissement : type, ville, adresse, horaires, urgences 24h/24, paiements acceptés, n° d'agrément, statut (en attente, validé, refusé, suspendu) |
| `hospital_members` | — | Comptes qui gèrent un établissement |
| `services` | HealthcareService | Services d'un établissement (maternité, pédiatrie…) |
| `tarifs` | ChargeItemDefinition | Tarifs publiés, en francs guinéens |
| `practitioners` | Practitioner | Médecin : spécialité, n° de l'Ordre, établissement garant |
| `hospital_doctors` | PractitionerRole | Médecin rattaché à un établissement et à un service (un médecin peut exercer dans plusieurs établissements) |
| `doctor_invitations` | — | Médecin enregistré par un établissement avant d'avoir un compte |
| `patients` | Patient | Identité, consentement, langue, rappels SMS, médecin traitant |
| `care_relationships` | CareTeam | Quel médecin suit quel patient (donne l'accès au dossier) |
| `slots` / `appointments` | Slot / Appointment | Créneaux et rendez-vous, **dans un établissement** |
| `messages` | Communication | Messagerie patient ↔ médecin |
| `medical_profiles`, `allergies`, `medical_history`, `vaccinations`, `documents` | Observation, AllergyIntolerance, Condition, Immunization, DocumentReference | Dossier médical |
| `prescriptions`, `prescription_items`, `medication_intakes` | MedicationRequest, MedicationAdministration | Ordonnances et plan de prise |
| `audit_log` | AuditEvent | Qui a lu ou modifié quoi, et quand |

## 4. Les quatre types de compte

| | Patient | Médecin | Établissement (gestionnaire) | Admin plateforme |
|---|---|---|---|---|
| Création du compte | Inscription libre | Enregistré par un établissement validé | Inscription libre, **en attente** de validation | Attribué manuellement |
| Voir les établissements | Validés seulement | Les siens | Le sien | Tous |
| Services, tarifs, fiche | Lecture | — | ✅ les siens | — |
| Enregistrer un médecin | — | — | ✅ si validé, avec n° de l'Ordre | — |
| Ouvrir des créneaux | — | — | ✅ pour ses médecins | — |
| Réserver | ✅ pour lui | — | ✅ pour un patient | — |
| Voir les rendez-vous | Les siens | Les siens (tous établissements) | Ceux de l'établissement | ❌ |
| Identité des patients | La sienne | Patients suivis | Patients venus dans l'établissement | ❌ |
| Dossier médical | ✅ le sien | ✅ patients suivis (consultation tracée) | ❌ | ❌ |
| Messagerie | Avec ses médecins | Avec ses patients | — | — |
| Valider / refuser / suspendre un établissement | — | — | — | ✅ |

**Accès d'un médecin au dossier d'un patient** : automatiquement quand le patient prend
rendez-vous avec lui ou le choisit comme médecin traitant. L'établissement, lui, ne voit
jamais le contenu médical.

**Un médecin « reconnu »** : il n'existe pas de registre en ligne de l'Ordre des médecins de
Guinée interrogeable automatiquement. Chaque établissement validé vérifie la carte du médecin
et certifie son inscription ; le numéro de l'Ordre est obligatoire, unique, et l'établissement
garant est affiché aux patients (« Inscrit à l'Ordre n° … »).

## 5. Actions serveur (`supabase.rpc(...)`)

| Fonction | Qui | Effet |
|---|---|---|
| `review_hospital(id, statut, motif)` | admin | Valide, refuse ou suspend un établissement |
| `register_hospital(...)` | compte neuf | Inscrit un établissement (aussi possible à l'inscription) |
| `add_doctor(établissement, e-mail, …, n° Ordre, service)` | établissement validé | Rattache un compte existant ou crée une invitation |
| `generate_slots(établissement, médecin, …)` | établissement validé | Ouvre des créneaux en série (sans chevauchement, même entre établissements) |
| `book_appointment(créneau, motif)` | patient | Réserve dans l'établissement du créneau ; donne l'accès au médecin |
| `cancel_appointment(id)` | patient, établissement | Annule et libère le créneau |
| `set_appointment_status(id, statut)` | médecin, établissement | Effectué ou absent |
| `set_medecin_traitant(médecin)` | patient | Choisit son médecin traitant (accès au dossier) |
| `mark_messages_read(patient, médecin)` | patient, médecin | Marque une conversation comme lue |
| `record_intake(id, statut)` | patient | Pris / non pris |
| `get_patient_record(patient)` | patient, médecin | Dossier complet (consultation tracée) |
| `export_my_data()` | patient | Export complet de ses données |
| `claim_sms_reminders()` | serveur uniquement | Rappels SMS à envoyer (voir `docs/SMS.md`) |

## 6. Parcours

```
Établissement s'inscrit ──▶ admin vérifie l'agrément et valide
      └─▶ l'établissement publie services et tarifs, enregistre ses médecins (n° de l'Ordre),
          ouvre leurs créneaux
Patient choisit un établissement ──▶ service (tarifs affichés) ──▶ médecin ──▶ créneau
      └─▶ le médecin accède au dossier ; consultation ; « effectué » ; ordonnance
      └─▶ rappels de prise (notification et SMS) ; le patient coche « pris »
      └─▶ le patient choisit un médecin traitant et lui écrit
```

## 7. Tester

```bash
scripts/test-db.sh
```
Crée un PostgreSQL temporaire, applique les migrations, lance les scénarios de sécurité, puis
charge les données de démo. Avec la CLI Supabase : `supabase db reset`.

Comptes de démo (mot de passe `Demo-Hopital-2026`) :

| Compte | Espace |
|---|---|
| `admin@demo.fr` | Administrateur de la plateforme |
| `gestion.dixinn@demo.fr` | Hôpital de démonstration de Dixinn (validé) |
| `gestion.ratoma@demo.fr` | Clinique de démonstration de Ratoma (en attente) |
| `dr.camara@demo.fr`, `dr.sylla@demo.fr` | Médecins de Dixinn |
| `mariama@demo.fr`, `mamadou@demo.fr` | Patients |

## 8. Pays : Guinée (Conakry)

- **Heure** : Africa/Conakry (UTC+0), côté base (`public.app_timezone()`) et côté app
  (`apps/mobile/src/constants/pays.ts`). Les deux doivent rester identiques.
- **Téléphones** : mobiles guinéens pour les patients (`+2246XXXXXXXX`) ; fixe ou mobile pour
  les établissements.
- **Tarifs** : en francs guinéens (GNF), affichés avant la réservation, payés sur place
  (espèces, Orange Money, MTN MoMo, carte, assurance selon l'établissement).
- **Urgences** affichées : police **117**, pompiers **18** (vérifiés en 2024). Aucun numéro
  national de SAMU n'est confirmé : l'app oriente vers les urgences de l'hôpital le plus proche.
- **Langues** : français, anglais ; soussou, pular et malinké prévus
  (`apps/mobile/src/i18n/guinee.ts`), affichés en français tant qu'ils ne sont pas traduits.
- **SMS** : rappels de prise via l'API SMS d'Orange Guinée (`docs/SMS.md`).
- **Loi** : loi L/2016/037/AN relative à la cybersécurité et à la protection des données à
  caractère personnel.

## 9. Reste à faire avant de vraies données (production)

- **Conformité à la loi L/2016/037/AN** : faire valider par un juriste guinéen le
  consentement, la politique de confidentialité, les durées de conservation, et
  l'**hébergement des données hors de Guinée** (le projet Supabase est à Paris).
- **Processus de vérification** des établissements (agrément) et des médecins (Ordre) :
  documents justificatifs, contrôle périodique, procédure de suspension.
- **Traductions** soussou, pular et malinké par des locuteurs natifs, relues par des soignants.
- **2FA** obligatoire (Supabase Auth MFA), en priorité pour les médecins et les établissements.
- Supprimer les comptes de démo (leur mot de passe est public).
- Saisie du dossier médical et des ordonnances par les médecins dans l'app (aujourd'hui en lecture).
- Plusieurs gestionnaires par établissement, accueil / secrétariat.
- Paiement en ligne (Orange Money, MTN MoMo) si souhaité.
- Mode hors connexion, suppression de compte, interopérabilité HL7 FHIR.
