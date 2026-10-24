# Application patient-hôpital — Ce qu'il faut + Prompt

Objectif : une application comme les portails patients des hôpitaux (type MyChart / Doctolib / Mon Espace Santé) :
prise de rendez-vous, dossier médical, traitements, ordonnances, rappels de prise de médicaments.

## 1. Ce qu'il te faut

### Trois interfaces, pas une seule
| Interface | Pour qui | Techno |
|---|---|---|
| **App mobile patient** | Patients | React Native + Expo (TypeScript) |
| **Portail web soignants** | Médecins, infirmiers, secrétariat | Next.js (React) + TypeScript |
| **Back-office admin** | Administrateurs de l'hôpital | Dans le portail web, avec un rôle « admin » |

Backend commun : **Supabase** (PostgreSQL, gestion des comptes, stockage des fichiers, fonctions serveur).

### Les modules
1. **Comptes et rôles** : patient, médecin, secrétaire, admin. Chaque rôle a ses propres droits.
2. **Rendez-vous** : services (cardiologie…), médecins, créneaux disponibles, réservation, annulation, rappel la veille.
3. **Dossier médical** : antécédents, allergies, groupe sanguin, comptes rendus, résultats d'analyses (PDF), vaccins.
4. **Ordonnances** : rédigées par le médecin, consultables et téléchargeables par le patient.
5. **Traitements** : médicament, dose, horaires, durée, plus un **plan de prise** avec notifications et un bouton « pris / pas pris ».
6. **Messagerie sécurisée** entre le patient et le service (optionnel en V1).
7. **Journal d'audit** : qui a consulté quel dossier, et quand (obligatoire en santé).

### Réglementation (France) — à connaître absolument
- **Données de santé = données sensibles (RGPD, art. 9).** Il faut un consentement, une finalité claire, le droit d'accès, d'export et de suppression, et une analyse d'impact (AIPD).
- **HDS** : l'hébergement de données de santé réelles doit se faire chez un hébergeur certifié HDS (ex. OVHcloud HDS, Scaleway HDS, AWS/Azure/GCP régions HDS). Supabase cloud n'est **pas** certifié HDS : il convient au prototype, pas à la production.
- **Authentification forte** : une double authentification (2FA) pour tous. Côté soignants, **Pro Santé Connect** (carte CPS / e-CPS).
- **Identité patient** : INS (Identifiant National de Santé) en production.
- **Interopérabilité** : pour échanger avec le système de l'hôpital, le standard est **HL7 FHIR** (ressources Patient, Practitioner, Appointment, MedicationRequest…). Il existe aussi Mon Espace Santé / DMP, et l'ordonnance numérique de l'Assurance Maladie.
- **Pas de diagnostic ni de calcul de dose automatique** : sinon le logiciel devient un dispositif médical (marquage CE).

👉 Conseil : construis d'abord un **prototype avec des fausses données**, puis passe sur une infrastructure HDS et fais valider par un DPO / juriste avant de manipuler de vraies données.

---

## 2. Le prompt (à copier-coller)

```
Tu es un architecte logiciel senior spécialisé dans les systèmes d'information hospitaliers.
Aide-moi à construire, étape par étape, un portail patient-hôpital. Je suis [débutant/intermédiaire] :
explique chaque étape simplement et donne-moi les commandes exactes à lancer.

## Produit
Nom : [NomDeLApp]. Langue : français. Pays : France.
Trois interfaces qui partagent le même backend :
1. App mobile PATIENT : React Native + Expo + TypeScript + Expo Router.
2. Portail web SOIGNANTS + ADMIN : Next.js (App Router) + TypeScript + Tailwind.
3. Backend : Supabase (PostgreSQL, Auth, Storage, Edge Functions). Monorepo (pnpm workspaces)
   avec un package partagé pour les types et les schémas zod.

## Rôles
patient, medecin, secretaire, admin. Droits gérés par Row Level Security (RLS) sur TOUTES les tables :
- un patient ne voit que ses propres données ;
- un médecin ne voit que les patients qu'il suit (lien de prise en charge) ;
- la secrétaire gère les rendez-vous mais n'a pas accès au contenu médical ;
- l'admin gère services, médecins, créneaux et comptes.

## Fonctionnalités
1. Authentification email + mot de passe avec 2FA ; consentement RGPD au premier lancement.
2. Rendez-vous : services, médecins, plages de disponibilité, réservation par le patient,
   annulation / report, statut (confirmé, annulé, honoré, absent), rappel par notification la veille.
3. Dossier médical : identité, antécédents, allergies, groupe sanguin, vaccins,
   comptes rendus et résultats d'analyses (PDF dans Supabase Storage, accès par URL signée).
4. Ordonnances : créées par le médecin (médicaments, posologie, durée), consultables et
   téléchargeables en PDF par le patient.
5. Traitements et plan de prise : à partir de l'ordonnance, générer les horaires de prise ;
   notifications locales (expo-notifications) ; le patient marque « pris / pas pris » ;
   historique d'observance visible par le médecin.
6. Tableau de bord patient : prochains rendez-vous, médicaments du jour, derniers documents.
7. Tableau de bord médecin : agenda du jour, liste de ses patients, fiche patient.
8. Journal d'audit : chaque lecture/modification d'un dossier est enregistrée (qui, quoi, quand).
9. Paramètres patient : export de toutes mes données (JSON/PDF) et suppression du compte.

## Exigences techniques
- Modèle de données inspiré de HL7 FHIR (Patient, Practitioner, Appointment, Schedule/Slot,
  MedicationRequest, MedicationAdministration, DocumentReference, AllergyIntolerance) pour
  faciliter une future interopérabilité.
- Aucune clé secrète côté client ; logique sensible dans des Edge Functions.
- Validation zod partout, gestion des erreurs et des états de chargement.
- Accessibilité (contrastes, tailles de police, lecteurs d'écran), mode clair/sombre.
- Données de démonstration (seed) entièrement fictives.
- Tests : unitaires sur la logique (génération des horaires de prise, créneaux),
  tests des policies RLS.
- Mention visible : « Cette application ne remplace pas un avis médical. »

## Méthode de travail
1. D'abord : architecture (arborescence du monorepo), schéma SQL complet avec policies RLS,
   liste des écrans par rôle, parcours utilisateur. Puis ATTENDS ma validation.
2. Ensuite, construis par étapes, en vérifiant que tout fonctionne avant de passer à la suivante :
   a. Auth + rôles  b. Rendez-vous  c. Dossier médical  d. Ordonnances
   e. Plan de prise + notifications  f. Audit + export/suppression.
3. À la fin : checklist de mise en production en France (hébergement HDS, AIPD RGPD,
   Pro Santé Connect, INS, interopérabilité FHIR / Mon Espace Santé, publication sur les stores).
```

---

## 3. Par où commencer
1. Crée un compte Supabase et un projet de test.
2. Installe Node.js, pnpm, VS Code et Expo Go.
3. Donne le prompt à Claude et valide l'architecture avant toute ligne de code.
4. Avance module par module, uniquement avec des données fictives.
