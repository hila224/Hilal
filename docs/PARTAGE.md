# Partager Hilal Santé avec des testeurs

Deux façons de tester, sans App Store ni Google Play :

| Testeur | Ce qu'il reçoit | Ce qu'il doit faire |
|---|---|---|
| Tout le monde (iPhone, Android, ordinateur) | Un **lien web**, ex. `https://hilal-sante.expo.app` | Ouvrir le lien. Sur téléphone : « Ajouter à l'écran d'accueil » |
| Android | Un **lien de téléchargement** de l'app (fichier APK) | L'ouvrir, autoriser l'installation, installer |

Les deux utilisent la même base de données Supabase (projet **hilal-sante**).

## 0. Avant de partager (une seule fois)

1. **Supprimer les comptes de démo** : copier le contenu de `supabase/scripts/nettoyage-demo.sql` dans le
   SQL Editor de Supabase (projet hilal-sante) et cliquer sur **Run**. Le compte
   `hilalsanoh@gmail.com` devient administrateur.
2. **Supabase → Authentication → Sign In / Providers → Email** : laisser « Confirm email »
   désactivé pendant les tests (sinon la limite d'e-mails bloque les inscriptions), ou brancher un
   service d'envoi d'e-mails (SMTP).
3. **Supabase → Authentication → URL Configuration** : mettre l'adresse du site
   (ex. `https://hilal-sante.expo.app`) dans « Site URL » et dans « Redirect URLs ».

## 1. Le site web (EAS Hosting, gratuit)

Sur le Mac, dans le Terminal :

```bash
cd ~/Hilal/apps/mobile
npm install -g eas-cli          # une seule fois
eas login                       # même compte que pour Expo Go
eas init                        # une seule fois : relie le projet à ton compte Expo
npx expo export -p web          # fabrique le site dans le dossier dist/
eas deploy --prod               # met le site en ligne
```

La première fois, `eas deploy` demande un nom (ex. `hilal-sante`) : l'adresse devient
`https://hilal-sante.expo.app`. Pour publier une nouvelle version : refaire les deux dernières
commandes.

## 2. L'app Android (fichier APK)

```bash
cd ~/Hilal/apps/mobile
eas build --platform android --profile preview
```

La fabrication se fait sur les serveurs d'Expo (environ 15 minutes). À la fin, un lien et un QR
code s'affichent : c'est ce lien qu'on envoie aux testeurs Android.

## 3. iPhone

Sans compte Apple Developer, les testeurs iPhone utilisent le **lien web**. Plus tard, avec un
compte Apple Developer (au nom d'une entreprise pour une app de santé), on passera par TestFlight.

## Message à envoyer aux testeurs

> Bonjour ! Je teste **Hilal Santé**, une application pour prendre rendez-vous dans les hôpitaux
> de Guinée et suivre son dossier médical.
> 👉 Lien : https://hilal-sante.expo.app (Android : lien de l'app ici)
> Créez un compte patient, essayez de prendre rendez-vous à « hilalsante test » et dites-moi ce
> qui vous plaît ou ce qui ne marche pas.
> ⚠️ C'est une version de test : n'y mettez pas vos vraies informations médicales.
> Un problème ? hilalsanoh@gmail.com ou +1 514 465 2240.
