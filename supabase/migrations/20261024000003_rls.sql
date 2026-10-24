-- =============================================================================
-- Sécurité : droits SQL + Row Level Security (RLS) sur toutes les tables.
--
--  Rôle        | Identité patients | Contenu médical          | Rendez-vous
--  ------------+-------------------+--------------------------+-----------------------
--  patient     | la sienne         | le sien (lecture)        | les siens
--  medecin     | patients suivis   | patients suivis (écrit.) | les siens
--  secretaire  | tous              | aucun                    | tous
--  admin       | tous              | aucun                    | tous
--
-- Les écritures sensibles (réservation, annulation, prise de médicament,
-- changement de rôle) passent uniquement par les fonctions de la migration 2.
-- =============================================================================

-- Aucun accès anonyme : il faut être connecté pour tout.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Fonctions appelables depuis l'application (supabase.rpc).
grant execute on function
  public.current_app_role(),
  public.is_practitioner_of(uuid),
  public.can_read_medical(uuid),
  public.set_user_role(uuid, public.app_role),
  public.generate_slots(uuid, date, date, time, time, int, int[]),
  public.book_appointment(uuid, text, uuid),
  public.cancel_appointment(uuid),
  public.set_appointment_status(uuid, public.appointment_status),
  public.record_intake(uuid, public.intake_status),
  public.get_patient_record(uuid),
  public.export_my_data()
to authenticated;

-- Écritures directes interdites là où une fonction serveur fait le travail.
revoke insert, update, delete on
  public.profiles, public.patients, public.appointments,
  public.medication_intakes, public.audit_log, public.prescription_items
from authenticated;
grant insert on public.prescription_items to authenticated;
-- Chacun ne peut modifier que ces colonnes de son propre profil.
grant update (prenom, nom, telephone) on public.profiles to authenticated;
grant update (date_naissance, sexe, consentement_rgpd_at) on public.patients to authenticated;

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comptes et organisation
-- -----------------------------------------------------------------------------

create policy "profils visibles" on public.profiles for select to authenticated
using (
  id = auth.uid()
  or role = 'medecin' -- les patients doivent voir le nom de leur médecin
  or public.current_app_role() in ('secretaire', 'admin')
  or public.is_practitioner_of(id)
);
create policy "modifier son profil" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "services visibles" on public.services for select to authenticated using (true);
create policy "admin gère les services" on public.services for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "médecins visibles" on public.practitioners for select to authenticated using (true);
create policy "admin gère les médecins" on public.practitioners for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "identité patient visible" on public.patients for select to authenticated
using (
  id = auth.uid()
  or public.is_practitioner_of(id)
  or public.current_app_role() in ('secretaire', 'admin')
);
create policy "modifier son identité" on public.patients for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "liens de prise en charge visibles" on public.care_relationships for select to authenticated
using (
  patient_id = auth.uid()
  or practitioner_id = auth.uid()
  or public.current_app_role() in ('secretaire', 'admin')
);
-- L'admin peut rattacher manuellement un médecin à un patient (ex. hospitalisation).
create policy "admin gère les prises en charge" on public.care_relationships for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

-- -----------------------------------------------------------------------------
-- Rendez-vous
-- -----------------------------------------------------------------------------

create policy "créneaux visibles" on public.slots for select to authenticated using (true);
create policy "secrétariat gère les créneaux" on public.slots for all to authenticated
using (public.current_app_role() in ('secretaire', 'admin'))
with check (public.current_app_role() in ('secretaire', 'admin'));

create policy "rendez-vous visibles" on public.appointments for select to authenticated
using (
  patient_id = auth.uid()
  or practitioner_id = auth.uid()
  or public.current_app_role() in ('secretaire', 'admin')
);

-- -----------------------------------------------------------------------------
-- Dossier médical : lecture par le patient et ses médecins,
-- écriture par ses médecins uniquement (chacun ne modifie que ses propres saisies).
-- -----------------------------------------------------------------------------

create policy "profil médical visible" on public.medical_profiles for select to authenticated
using (public.can_read_medical(patient_id));
create policy "médecin crée le profil médical" on public.medical_profiles for insert to authenticated
with check (public.is_practitioner_of(patient_id) and updated_by = auth.uid());
create policy "médecin modifie le profil médical" on public.medical_profiles for update to authenticated
using (public.is_practitioner_of(patient_id))
with check (public.is_practitioner_of(patient_id) and updated_by = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array['allergies', 'medical_history', 'vaccinations', 'documents'] loop
    execute format($p$
      create policy "lecture" on public.%1$I for select to authenticated
      using (public.can_read_medical(patient_id));
      create policy "ajout par un médecin" on public.%1$I for insert to authenticated
      with check (public.is_practitioner_of(patient_id) and created_by = auth.uid());
      create policy "modification par son auteur" on public.%1$I for update to authenticated
      using (public.is_practitioner_of(patient_id) and created_by = auth.uid())
      with check (public.is_practitioner_of(patient_id) and created_by = auth.uid());
      create policy "suppression par son auteur" on public.%1$I for delete to authenticated
      using (public.is_practitioner_of(patient_id) and created_by = auth.uid());
    $p$, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ordonnances et traitements
-- -----------------------------------------------------------------------------

create policy "ordonnances visibles" on public.prescriptions for select to authenticated
using (public.can_read_medical(patient_id));
create policy "médecin prescrit" on public.prescriptions for insert to authenticated
with check (practitioner_id = auth.uid() and public.is_practitioner_of(patient_id));
create policy "prescripteur modifie" on public.prescriptions for update to authenticated
using (practitioner_id = auth.uid() and public.is_practitioner_of(patient_id))
with check (practitioner_id = auth.uid() and public.is_practitioner_of(patient_id));

create policy "lignes visibles" on public.prescription_items for select to authenticated
using (exists (
  select 1 from public.prescriptions p
  where p.id = prescription_id and public.can_read_medical(p.patient_id)
));
create policy "prescripteur ajoute des lignes" on public.prescription_items for insert to authenticated
with check (exists (
  select 1 from public.prescriptions p
  where p.id = prescription_id
    and p.practitioner_id = auth.uid()
    and p.statut = 'active'
    and public.is_practitioner_of(p.patient_id)
));

create policy "prises visibles" on public.medication_intakes for select to authenticated
using (public.can_read_medical(patient_id));

-- -----------------------------------------------------------------------------
-- Audit : l'admin voit tout, le patient voit qui a accédé à son dossier.
-- -----------------------------------------------------------------------------

create policy "journal visible" on public.audit_log for select to authenticated
using (patient_id = auth.uid() or public.current_app_role() = 'admin');
