# Mettre à jour Hilal Santé soi-même

## 1. Ce qui se change directement dans l'app (sans toucher au code)

| Quoi | Où | Avec quel compte |
|---|---|---|
| Valider, refuser, suspendre un établissement | Espace administrateur | `hilalsanoh@gmail.com` |
| Services, tarifs, fiche de l'établissement | Onglets « Tarifs » et « Fiche » | Gestionnaire de l'établissement |
| Enregistrer un médecin, ouvrir ses créneaux | Onglet « Médecins » | Gestionnaire de l'établissement |
| Consultations, ordonnances, dossiers | Espace médecin | Médecin |

Ces changements sont visibles tout de suite par tout le monde : rien à republier.

## 2. Petites modifications du code (avec VS Code)

Ouvrir le dossier `Hilal` dans VS Code, puis modifier :

| Pour changer… | Fichier |
|---|---|
| Un texte de l'app (français) | `apps/mobile/src/i18n/fr.ts` |
| Le même texte en anglais | `apps/mobile/src/i18n/en.ts` |
| E-mail et téléphone de l'assistance | `apps/mobile/src/constants/support.ts` |
| Numéros d'urgence, fuseau horaire | `apps/mobile/src/constants/pays.ts` |
| Couleurs | `apps/mobile/src/constants/theme.ts` |
| Logo et icônes | `apps/mobile/assets/images/` et `docs/logo/` |

Règle d'or : changer seulement le texte **entre les apostrophes**, sans toucher au reste de la
ligne. Exemple : `tagline: 'Votre santé, entre de bonnes mains.',`

### Vérifier avant de publier

```bash
cd ~/Hilal/apps/mobile
npm run verifier       # aucune erreur ne doit s'afficher
npx expo start         # puis scanner le QR code avec Expo Go pour voir le résultat
```

## 3. Publier

Toujours depuis `~/Hilal/apps/mobile` :

| Pour mettre à jour… | Commande | Résultat |
|---|---|---|
| Le **site** (iPhone, ordinateur, et Android par le site) | `npm run site` | https://hilal-sante.expo.app est à jour en 2 minutes |
| L'**app Android** | `npm run app-android` | Un **nouveau lien** d'installation (10 à 20 min) à renvoyer aux testeurs |

## 4. Garder une copie de ses changements sur GitHub

Dans VS Code : icône **Source Control** (à gauche, les trois ronds reliés) → écrire un message
(ex. « Nouveau texte d'accueil ») → **Commit** → **Sync Changes**.

Avant de récupérer les changements faits par quelqu'un d'autre (`git pull`), enregistrer d'abord
les siens de cette façon.

## 5. La base de données (Supabase)

- Les données (comptes, établissements, rendez-vous) se consultent dans **Table Editor**.
- Les changements de structure (nouvelles tables, règles de sécurité) passent par des fichiers
  de `supabase/migrations/` : ils demandent des tests (`scripts/test-db.sh`) avant d'être appliqués.
- Ne jamais copier la clé `service_role` dans l'app.

## 6. En cas de problème

- Une commande affiche **error** : relire le message, souvent il dit quoi faire.
- Le site affiche une page blanche après une modification : revenir en arrière dans VS Code
  (Source Control → clic droit sur le fichier → « Discard Changes »), puis republier.
