# Hilal — Portail patient-hôpital

Application pour prendre rendez-vous à l'hôpital, consulter son dossier médical, ses ordonnances
et suivre la prise de ses médicaments. Elle comprend une app mobile pour les patients et un portail
web pour les soignants et l'administration.

- `apps/mobile/` : l'app mobile patient (voir son README pour la lancer sur ton téléphone)
- `docs/ARCHITECTURE.md` : architecture, modèle de données, droits d'accès, écrans
- `supabase/migrations/` : base de données et règles de sécurité (RLS)
- `supabase/seed.sql` : données de démonstration **fictives**
- `PROMPT_APP_SANTE.md` : le prompt et la liste de ce qu'il faut

## Tester la base de données

```bash
scripts/test-db.sh
```

> ⚠️ Prototype : ne pas utiliser avec de vraies données de santé avant un hébergement HDS
> et une mise en conformité RGPD (voir `docs/ARCHITECTURE.md`, section 9).
