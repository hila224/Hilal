# Application de santé — Ce qu'il faut + Prompt

## 1. Ce qu'il te faut

### Définir le projet (avant de coder)
- **Le problème** : qu'est-ce que l'app résout ? (suivi d'hydratation, sommeil, poids, médicaments, humeur, sport…)
- **La cible** : grand public, patients chroniques, sportifs, seniors ?
- **Le MVP** : 3 à 5 fonctionnalités maximum pour la première version.

### Stack technique recommandée
| Besoin | Outil | Pourquoi |
|---|---|---|
| App mobile (iOS + Android) | **React Native + Expo** (TypeScript) | Un seul code pour les deux plateformes, facile à tester sur ton téléphone avec Expo Go |
| Backend / base de données | **Supabase** (PostgreSQL + Auth + Storage) | Gratuit pour démarrer, authentification incluse, sécurité par lignes (RLS) |
| Graphiques | `victory-native` ou `react-native-gifted-charts` | Visualiser l'évolution des données |
| Notifications | `expo-notifications` | Rappels (médicaments, eau…) |
| Données santé du téléphone (optionnel) | Apple HealthKit / Google Health Connect | Récupérer pas, sommeil, fréquence cardiaque |
| Validation des formulaires | `zod` + `react-hook-form` | Données propres et fiables |

### Outils à installer
- Node.js (LTS) et npm
- Git + un compte GitHub
- Expo Go sur ton téléphone
- Un compte Supabase
- Un éditeur : VS Code

### Points importants spécifiques à la santé
- **RGPD** : les données de santé sont des *données sensibles* (art. 9). Il faut le consentement explicite, une politique de confidentialité, le droit de supprimer/exporter ses données.
- **Hébergement** : en France, stocker des données de santé pour le compte de tiers exige un hébergeur **HDS** (Hébergeur de Données de Santé). Pour un projet perso/prototype, ce n'est pas bloquant, mais pour un lancement public, oui.
- **Pas de diagnostic** : l'app ne doit pas se présenter comme un dispositif médical (sinon marquage CE / réglementation MDR). Ajouter un avertissement « ne remplace pas un avis médical ».
- **Sécurité** : chiffrement HTTPS, Row Level Security sur Supabase (chaque utilisateur ne voit que ses données), pas de données sensibles en clair sur le téléphone.
- **Accessibilité** : textes lisibles, contrastes, compatibilité lecteurs d'écran.

---

## 2. Le prompt (à copier-coller)

> Remplace ce qui est entre [crochets] selon ton idée.

```
Tu es un développeur senior spécialisé en applications mobiles de santé.
Aide-moi à créer une application mobile de santé, étape par étape.

## Contexte
- Nom de l'app : [NomDeLApp]
- Objectif : aider [les utilisateurs cibles, ex : les jeunes adultes] à [objectif, ex : suivre leur hydratation, leur sommeil, leur humeur et leurs médicaments].
- Langue de l'interface : français.
- Je suis [débutant / intermédiaire] : explique chaque étape simplement.

## Stack imposée
- React Native avec Expo (SDK récent) et TypeScript
- Expo Router pour la navigation
- Supabase pour l'authentification (email + mot de passe) et la base de données PostgreSQL
- zod + react-hook-form pour les formulaires
- expo-notifications pour les rappels
- Une librairie de graphiques compatible Expo

## Fonctionnalités du MVP
1. Inscription / connexion / déconnexion, avec écran de consentement RGPD au premier lancement.
2. Profil : prénom, date de naissance, taille, poids, objectifs.
3. Saisie quotidienne : [eau (ml), heures de sommeil, humeur 1-5, poids, pas].
4. Tableau de bord : résumé du jour + graphiques sur 7 et 30 jours.
5. Rappels configurables (ex : boire de l'eau, prendre un médicament).
6. Paramètres : exporter mes données (JSON/CSV) et supprimer mon compte et toutes mes données.

## Exigences
- Sécurité : Row Level Security activée sur toutes les tables Supabase, chaque utilisateur n'accède qu'à ses propres données. Aucune clé secrète dans l'app.
- Afficher un avertissement : « Cette application ne remplace pas un avis médical. »
- Design épuré, accessible (contrastes, tailles de police, labels d'accessibilité), mode clair et sombre.
- Code propre, organisé par dossiers (app/, components/, lib/, hooks/, types/), commenté quand c'est utile.
- Gestion des erreurs et des états de chargement sur chaque écran.

## Ce que j'attends de toi
1. D'abord, propose l'architecture : arborescence des fichiers, schéma SQL des tables Supabase (avec les policies RLS), et liste des écrans.
2. Attends ma validation.
3. Ensuite, génère le code écran par écran, en me donnant à chaque fois les commandes à lancer et comment tester sur mon téléphone avec Expo Go.
4. À la fin, donne-moi une checklist pour publier sur l'App Store et le Google Play Store, et les points RGPD/HDS à vérifier avant un lancement public.
```

---

## 3. Étapes suivantes
1. Choisis ton idée précise et complète les [crochets].
2. Crée un projet Supabase.
3. Lance `npx create-expo-app@latest [nom-app] --template` et donne le prompt à Claude.
4. Avance fonctionnalité par fonctionnalité, en testant à chaque étape.
