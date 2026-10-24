-- =============================================================================
-- Durcissement suite au conseiller de sécurité Supabase.
-- =============================================================================

-- Fonctions de trigger : jamais appelées directement depuis l'API.
revoke execute on function
  public.audit_write(),
  public.handle_new_user(),
  public.generate_intakes(),
  public.cleanup_intakes()
from public, anon, authenticated;

-- Chemin de recherche figé pour toutes les fonctions.
alter function public.app_timezone() set search_path = '';
alter function public.storage_patient_id(text) set search_path = '';
