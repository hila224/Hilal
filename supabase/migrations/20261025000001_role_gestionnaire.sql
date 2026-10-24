-- Nouveau rôle : gestionnaire d'un établissement de santé (hôpital, clinique, centre de santé).
-- Dans une migration à part : PostgreSQL n'autorise pas l'usage d'une nouvelle valeur
-- d'enum dans la transaction qui la crée.
alter type public.app_role add value if not exists 'gestionnaire';
