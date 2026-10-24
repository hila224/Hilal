-- =============================================================================
-- Stockage des documents médicaux (PDF, images) dans un bucket privé.
-- Chemin obligatoire : "<patient_id>/<nom_du_fichier>".
-- L'application affiche les fichiers via des URL signées à durée courte.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create function public.storage_patient_id(p_name text)
returns uuid
language sql immutable
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;
grant execute on function public.storage_patient_id(text) to authenticated;

create policy "documents : lecture" on storage.objects for select to authenticated
using (bucket_id = 'documents' and public.can_read_medical(public.storage_patient_id(name)));

create policy "documents : dépôt par un médecin" on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and public.is_practitioner_of(public.storage_patient_id(name)));

create policy "documents : suppression par un médecin" on storage.objects for delete to authenticated
using (bucket_id = 'documents' and public.is_practitioner_of(public.storage_patient_id(name)));
