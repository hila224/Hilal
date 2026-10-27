# Rappels de médicaments par SMS (Guinée)

Les patients qui activent l'option dans **Profil → Rappels de médicaments → SMS** reçoivent un
SMS à l'heure de chaque prise, même sans smartphone connecté. Le texte est neutre (« Hilal
Santé : c'est l'heure de votre traitement… ») : il ne cite jamais le médicament, car un SMS
peut être lu par quelqu'un d'autre. Il est envoyé dans la langue choisie par le patient
(français ou anglais ; le soussou, le pular et le malinké utilisent le français en attendant
leur traduction).

## Fonctionnement

```
Tâche planifiée (toutes les 5 min)
   └─▶ Edge Function « rappels-sms »  (supabase/functions/rappels-sms)
         ├─ claim_sms_reminders() : prises prévues dans les 30 dernières minutes,
         │   pas encore prises ni rappelées, patient avec SMS activés et numéro +224
         │   → marquées « rappelées » dans la même requête (jamais deux SMS)
         ├─ API SMS d'Orange Guinée : un SMS par patient et par horaire
         └─ release_sms_reminders() si l'envoi échoue → nouvel essai au passage suivant
```

## Mise en route

### 1. Compte Orange Developer
1. Créer un compte sur https://developer.orange.com et une application.
2. Ajouter l'API **« SMS Guinea Conakry »** à l'application et acheter un forfait de SMS
   (payable en crédit ou Orange Money).
3. Noter le **Client ID** et le **Client Secret**.
4. Facultatif : demander à Orange un **nom d'expéditeur** (ex. « HilalSante », 11 caractères max).

### 2. Déployer la fonction
```bash
npx supabase login
npx supabase link --project-ref <id-du-projet>
npx supabase functions deploy rappels-sms --no-verify-jwt
```
`--no-verify-jwt` : la fonction est protégée par son propre secret (`CRON_SECRET`), pas par
la connexion d'un utilisateur.

### 3. Définir les secrets
Dans Supabase : **Edge Functions → Secrets** (ou `npx supabase secrets set NOM=valeur`) :

| Secret | Valeur |
|---|---|
| `CRON_SECRET` | une longue chaîne aléatoire, que vous inventez |
| `ORANGE_CLIENT_ID` | fourni par Orange |
| `ORANGE_CLIENT_SECRET` | fourni par Orange |
| `ORANGE_SMS_SENDER` | facultatif, par défaut `tel:+2240000` |
| `ORANGE_SMS_SENDER_NAME` | facultatif, nom d'expéditeur validé par Orange |

### 4. Planifier l'envoi toutes les 5 minutes
Dans **Database → Extensions**, activer `pg_cron` et `pg_net`, puis dans le **SQL Editor** :

```sql
select cron.schedule(
  'rappels-sms',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<id-du-projet>.supabase.co/functions/v1/rappels-sms',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
```

Pour vérifier : la fonction répond `{"envoyes": N, "echecs": M}` ; ses journaux sont dans
**Edge Functions → rappels-sms → Logs**.

## Tests

- `scripts/test-db.sh` vérifie (scénario 14) qu'un patient ne peut ni déclencher l'envoi ni
  modifier l'état des SMS, et qu'un rappel n'est réservé qu'une fois puis remis en file en cas d'échec.
- La fonction a été testée de bout en bout avec Deno contre un faux serveur Orange : regroupement
  de plusieurs médicaments en un seul SMS, aucun doublon au passage suivant, nouvel essai après un refus.
  **Elle n'a pas encore été testée avec la vraie API Orange** : faire un premier essai avec un
  seul numéro de test.
