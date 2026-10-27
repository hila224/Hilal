-- =============================================================================
-- Dossier médical complet
--
--  - Le patient complète lui-même son identité (adresse, profession, personne à
--    prévenir, assurance) et son dossier : profil médical, allergies, antécédents,
--    traitements habituels, vaccins, documents. Ses saisies restent signalées
--    « déclaré par le patient ».
--  - Le médecin qui suit le patient rédige des consultations (motif, examen,
--    diagnostic, conduite à tenir, constantes), prescrit en une seule opération
--    (create_prescription) et dépose des documents.
--  - get_patient_record renvoie la fiche complète : identité, alertes,
--    consultations, ordonnances avec observance, rendez-vous.
--
-- Migration additive : aucune table, colonne ni donnée n'est supprimée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identité du patient
-- -----------------------------------------------------------------------------

alter table public.patients
  add column ville                text check (ville is null or length(trim(ville)) between 2 and 80),
  add column commune              text check (commune is null or length(trim(commune)) <= 80),
  add column adresse              text check (adresse is null or length(trim(adresse)) <= 200),
  add column profession           text check (profession is null or length(trim(profession)) <= 80),
  add column situation_familiale  text check (situation_familiale in ('celibataire', 'marie', 'divorce', 'veuf')),
  add column contact_urgence_nom  text check (contact_urgence_nom is null or length(trim(contact_urgence_nom)) between 2 and 120),
  add column contact_urgence_lien text check (contact_urgence_lien is null or length(trim(contact_urgence_lien)) <= 40),
  add column contact_urgence_tel  text check (contact_urgence_tel is null or contact_urgence_tel ~ '^\+224[0-9]{9}$'),
  add column assurance            text check (assurance is null or length(trim(assurance)) <= 120),
  add column numero_assurance     text check (numero_assurance is null or length(trim(numero_assurance)) <= 60);

alter table public.patients
  add constraint patients_date_naissance_check check (date_naissance between date '1900-01-01' and current_date);

grant update (
  ville, commune, adresse, profession, situation_familiale,
  contact_urgence_nom, contact_urgence_lien, contact_urgence_tel, assurance, numero_assurance
) on public.patients to authenticated;

-- -----------------------------------------------------------------------------
-- Profil médical : électrophorèse (drépanocytose), habitudes, grossesse
-- -----------------------------------------------------------------------------

alter table public.medical_profiles
  add column electrophorese  text check (electrophorese in ('AA', 'AS', 'SS', 'AC', 'SC')),
  add column tabac           text check (tabac in ('non', 'ancien', 'actuel')),
  add column alcool          text check (alcool in ('non', 'occasionnel', 'regulier')),
  add column grossesse       boolean;

-- Le patient renseigne son propre profil ; « updated_by » indique qui l'a fait.
create policy "patient crée son profil médical" on public.medical_profiles for insert to authenticated
with check (patient_id = auth.uid() and updated_by = auth.uid());
create policy "patient modifie son profil médical" on public.medical_profiles for update to authenticated
using (patient_id = auth.uid()) with check (patient_id = auth.uid() and updated_by = auth.uid());

-- Problème de santé en cours (maladie chronique : diabète, hypertension…).
alter table public.medical_history add column actif boolean not null default false;

-- Documents : description et consultation d'origine.
alter table public.documents add column description text check (description is null or length(description) <= 500);

-- -----------------------------------------------------------------------------
-- Traitements habituels (FHIR : MedicationStatement)
-- Médicaments pris en dehors des ordonnances de l'app.
-- -----------------------------------------------------------------------------

create table public.traitements_habituels (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  medicament  text not null check (length(trim(medicament)) between 2 and 120),
  posologie   text check (posologie is null or length(posologie) <= 200),
  depuis      date,
  actif       boolean not null default true,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index on public.traitements_habituels (patient_id);
alter table public.traitements_habituels enable row level security;
revoke all on public.traitements_habituels from anon;

create policy "lecture" on public.traitements_habituels for select to authenticated
using (public.can_read_medical(patient_id));
create policy "ajout par un médecin" on public.traitements_habituels for insert to authenticated
with check (public.is_practitioner_of(patient_id) and created_by = auth.uid());
create policy "modification par son auteur" on public.traitements_habituels for update to authenticated
using (public.is_practitioner_of(patient_id) and created_by = auth.uid())
with check (public.is_practitioner_of(patient_id) and created_by = auth.uid());
create policy "suppression par son auteur" on public.traitements_habituels for delete to authenticated
using (public.is_practitioner_of(patient_id) and created_by = auth.uid());

-- Le patient complète son dossier ; il ne modifie que ses propres saisies,
-- jamais celles d'un médecin.
do $$
declare
  t text;
begin
  foreach t in array array['allergies', 'medical_history', 'vaccinations', 'documents', 'traitements_habituels'] loop
    execute format($p$
      create policy "ajout par le patient" on public.%1$I for insert to authenticated
      with check (patient_id = auth.uid() and created_by = auth.uid());
      create policy "modification par le patient" on public.%1$I for update to authenticated
      using (patient_id = auth.uid() and created_by = auth.uid())
      with check (patient_id = auth.uid() and created_by = auth.uid());
      create policy "suppression par le patient" on public.%1$I for delete to authenticated
      using (patient_id = auth.uid() and created_by = auth.uid());
    $p$, t);
  end loop;
end;
$$;

-- Le patient dépose ses documents (anciens résultats, ordonnances papier…) dans
-- son propre dossier, et peut retirer ceux qu'il a déposés.
create policy "documents : dépôt par le patient" on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and public.storage_patient_id(name) = auth.uid());
-- Il ne peut pas retirer un fichier déposé par un médecin.
create policy "documents : suppression par le patient" on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and public.storage_patient_id(name) = auth.uid()
  and not exists (select 1 from public.documents d where d.storage_path = name and d.created_by <> auth.uid())
);

-- -----------------------------------------------------------------------------
-- Consultations (FHIR : Encounter + Observation pour les constantes)
-- -----------------------------------------------------------------------------

create table public.consultations (
  id                      uuid primary key default gen_random_uuid(),
  patient_id              uuid not null references public.patients (id) on delete cascade,
  practitioner_id         uuid not null references public.practitioners (id),
  hospital_id             uuid references public.hospitals (id),
  appointment_id          uuid unique references public.appointments (id),
  date_consultation       timestamptz not null default now(),
  motif                   text not null check (length(trim(motif)) between 2 and 500),
  histoire                text check (histoire is null or length(histoire) <= 5000),   -- anamnèse
  examen                  text check (examen is null or length(examen) <= 5000),       -- examen clinique
  diagnostic              text check (diagnostic is null or length(diagnostic) <= 1000),
  conduite                text check (conduite is null or length(conduite) <= 5000),   -- conduite à tenir
  -- Constantes
  tension_sys             int check (tension_sys between 40 and 300),
  tension_dia             int check (tension_dia between 20 and 200),
  pouls                   int check (pouls between 20 and 250),
  temperature             numeric(3, 1) check (temperature between 30 and 45),
  frequence_respiratoire  int check (frequence_respiratoire between 4 and 80),
  saturation              int check (saturation between 50 and 100),
  glycemie                numeric(4, 2) check (glycemie between 0.2 and 6),             -- g/L
  poids_kg                numeric(5, 1) check (poids_kg between 1 and 400),
  taille_cm               int check (taille_cm between 30 and 260),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (tension_sys is null or tension_dia is null or tension_sys > tension_dia)
);
create index on public.consultations (patient_id, date_consultation desc);
create index on public.consultations (practitioner_id);
alter table public.consultations enable row level security;
revoke all on public.consultations from anon;

create policy "consultations visibles" on public.consultations for select to authenticated
using (public.can_read_medical(patient_id));
-- Seul un médecin qui suit le patient rédige, dans un établissement où il exerce,
-- éventuellement à partir de son propre rendez-vous avec ce patient.
create policy "médecin rédige une consultation" on public.consultations for insert to authenticated
with check (
  practitioner_id = auth.uid()
  and public.is_practitioner_of(patient_id)
  and (hospital_id is null or exists (
    select 1 from public.hospital_doctors hd
    where hd.hospital_id = consultations.hospital_id and hd.practitioner_id = auth.uid()
  ))
  and (appointment_id is null or exists (
    select 1 from public.appointments a
    where a.id = consultations.appointment_id
      and a.patient_id = consultations.patient_id
      and a.practitioner_id = auth.uid()
  ))
);
create policy "auteur modifie sa consultation" on public.consultations for update to authenticated
using (practitioner_id = auth.uid() and public.is_practitioner_of(patient_id))
with check (practitioner_id = auth.uid() and public.is_practitioner_of(patient_id));

-- Une consultation n'est jamais supprimée ; seuls le contenu clinique et les
-- constantes se corrigent.
revoke update, delete on public.consultations from authenticated;
grant update (
  date_consultation, motif, histoire, examen, diagnostic, conduite,
  tension_sys, tension_dia, pouls, temperature, frequence_respiratoire, saturation, glycemie, poids_kg, taille_cm
) on public.consultations to authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger consultations_touch
  before update on public.consultations
  for each row execute function public.touch_updated_at();

-- Le poids et la taille mesurés en consultation mettent à jour le profil médical.
create function public.sync_vitals_to_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.poids_kg is not null or new.taille_cm is not null then
    insert into public.medical_profiles (patient_id, poids_kg, taille_cm, updated_by, updated_at)
    values (new.patient_id, new.poids_kg, new.taille_cm, new.practitioner_id, now())
    on conflict (patient_id) do update
      set poids_kg = coalesce(excluded.poids_kg, public.medical_profiles.poids_kg),
          taille_cm = coalesce(excluded.taille_cm, public.medical_profiles.taille_cm),
          updated_by = excluded.updated_by,
          updated_at = now();
  end if;
  return null;
end;
$$;

create trigger consultations_sync_vitals
  after insert or update of poids_kg, taille_cm on public.consultations
  for each row execute function public.sync_vitals_to_profile();

create trigger consultations_audit
  after insert or update or delete on public.consultations
  for each row execute function public.audit_write();
create trigger traitements_habituels_audit
  after insert or update or delete on public.traitements_habituels
  for each row execute function public.audit_write();

revoke execute on function public.touch_updated_at(), public.sync_vitals_to_profile()
from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ordonnances : rattachées à la consultation et à l'établissement
-- -----------------------------------------------------------------------------

alter table public.prescriptions
  add column consultation_id  uuid references public.consultations (id),
  add column hospital_id      uuid references public.hospitals (id);

alter table public.documents add column consultation_id uuid references public.consultations (id);

-- Le prescripteur ne change que le statut (arrêt) et les notes.
revoke update on public.prescriptions from authenticated;
grant update (statut, notes) on public.prescriptions to authenticated;

-- Ordonnance complète en une seule opération (en-tête + lignes + plan de prise).
-- p_items : [{ "medicament", "dosage", "voie", "horaires": ["08:00", …],
--              "date_debut": "AAAA-MM-JJ", "date_fin": "AAAA-MM-JJ", "instructions" }]
create function public.create_prescription(
  p_patient_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_consultation_id uuid default null,
  p_hospital_id uuid default null
)
returns public.prescriptions
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hospital uuid := p_hospital_id;
  v_prescription public.prescriptions;
  v_item jsonb;
  v_horaires time[];
  v_debut date;
  v_fin date;
begin
  if public.current_app_role() is distinct from 'medecin' or not public.is_practitioner_of(p_patient_id) then
    raise exception 'Seul un médecin qui suit ce patient peut prescrire' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Une ordonnance contient de 1 à 20 médicaments';
  end if;

  if p_consultation_id is not null then
    select coalesce(v_hospital, c.hospital_id) into v_hospital
    from public.consultations c
    where c.id = p_consultation_id and c.patient_id = p_patient_id and c.practitioner_id = v_uid;
    if not found then
      raise exception 'Consultation introuvable';
    end if;
  end if;
  if v_hospital is not null and not exists (
    select 1 from public.hospital_doctors where hospital_id = v_hospital and practitioner_id = v_uid
  ) then
    raise exception 'Vous n''exercez pas dans cet établissement' using errcode = '42501';
  end if;

  insert into public.prescriptions (patient_id, practitioner_id, notes, consultation_id, hospital_id)
  values (p_patient_id, v_uid, nullif(trim(p_notes), ''), p_consultation_id, v_hospital)
  returning * into v_prescription;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if length(trim(coalesce(v_item ->> 'medicament', ''))) < 2 or length(trim(coalesce(v_item ->> 'dosage', ''))) < 1 then
      raise exception 'Chaque médicament doit avoir un nom et une posologie';
    end if;
    begin
      select array_agg(distinct h::time order by h::time) into v_horaires
      from jsonb_array_elements_text(v_item -> 'horaires') h;
      v_debut := (v_item ->> 'date_debut')::date;
      v_fin := (v_item ->> 'date_fin')::date;
    exception when others then
      raise exception 'Horaires ou dates invalides pour %', v_item ->> 'medicament';
    end;
    if coalesce(cardinality(v_horaires), 0) not between 1 and 12 then
      raise exception 'De 1 à 12 horaires de prise pour %', v_item ->> 'medicament';
    end if;
    if v_debut is null or v_fin is null or v_debut < current_date - 1 or v_fin < v_debut or v_fin - v_debut > 366 then
      raise exception 'Dates invalides pour % (traitement d''un an au plus)', v_item ->> 'medicament';
    end if;

    insert into public.prescription_items (prescription_id, medicament, dosage, voie, horaires, date_debut, date_fin, instructions)
    values (
      v_prescription.id,
      trim(v_item ->> 'medicament'),
      trim(v_item ->> 'dosage'),
      nullif(trim(v_item ->> 'voie'), ''),
      v_horaires,
      v_debut,
      v_fin,
      nullif(trim(v_item ->> 'instructions'), '')
    );
  end loop;

  return v_prescription;
end;
$$;

revoke execute on function public.create_prescription(uuid, jsonb, text, uuid, uuid) from public, anon;
grant execute on function public.create_prescription(uuid, jsonb, text, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Fiche patient complète
-- -----------------------------------------------------------------------------

-- Qui a saisi un élément du dossier : le patient lui-même, ou tel médecin.
create function public.record_author(p_created_by uuid, p_patient_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'par_patient', p_created_by = p_patient_id,
    'auteur', (select jsonb_build_object('prenom', pr.prenom, 'nom', pr.nom, 'role', pr.role)
               from public.profiles pr where pr.id = p_created_by)
  )
$$;
revoke execute on function public.record_author(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_patient_record(p_patient_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_record jsonb;
begin
  if not public.can_read_medical(p_patient_id) then
    raise exception 'Accès au dossier refusé' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'identite', (
      select to_jsonb(x) from (
        select pr.prenom, pr.nom, pr.telephone, pa.date_naissance, pa.sexe,
               pa.ville, pa.commune, pa.adresse, pa.profession, pa.situation_familiale,
               pa.contact_urgence_nom, pa.contact_urgence_lien, pa.contact_urgence_tel,
               pa.assurance, pa.numero_assurance,
               (select jsonb_build_object('id', mt.id, 'prenom', mt.prenom, 'nom', mt.nom)
                from public.profiles mt where mt.id = pa.medecin_traitant_id) as medecin_traitant
        from public.patients pa join public.profiles pr on pr.id = pa.id
        where pa.id = p_patient_id
      ) x
    ),
    'profil_medical', (
      select to_jsonb(m) - 'patient_id' || jsonb_build_object('par_patient', m.updated_by = p_patient_id)
      from public.medical_profiles m where m.patient_id = p_patient_id
    ),
    'allergies', coalesce((
      select jsonb_agg(to_jsonb(a) || public.record_author(a.created_by, p_patient_id) order by a.created_at)
      from public.allergies a where a.patient_id = p_patient_id
    ), '[]'),
    'antecedents', coalesce((
      select jsonb_agg(to_jsonb(h) || public.record_author(h.created_by, p_patient_id)
                       order by h.actif desc, h.date_evenement desc nulls last)
      from public.medical_history h where h.patient_id = p_patient_id
    ), '[]'),
    'traitements_habituels', coalesce((
      select jsonb_agg(to_jsonb(t) || public.record_author(t.created_by, p_patient_id) order by t.actif desc, t.created_at desc)
      from public.traitements_habituels t where t.patient_id = p_patient_id
    ), '[]'),
    'vaccinations', coalesce((
      select jsonb_agg(to_jsonb(v) || public.record_author(v.created_by, p_patient_id) order by v.date_administration desc)
      from public.vaccinations v where v.patient_id = p_patient_id
    ), '[]'),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) || public.record_author(d.created_by, p_patient_id) order by d.created_at desc)
      from public.documents d where d.patient_id = p_patient_id
    ), '[]'),
    'consultations', coalesce((
      select jsonb_agg(
        to_jsonb(c) || jsonb_build_object(
          'medecin', (select jsonb_build_object('prenom', pr.prenom, 'nom', pr.nom, 'specialite', p.specialite)
                      from public.practitioners p join public.profiles pr on pr.id = p.id where p.id = c.practitioner_id),
          'etablissement', (select h.nom from public.hospitals h where h.id = c.hospital_id)
        ) order by c.date_consultation desc)
      from public.consultations c where c.patient_id = p_patient_id
    ), '[]'),
    'ordonnances', coalesce((
      select jsonb_agg(
        to_jsonb(p) || jsonb_build_object(
          'prescripteur', (select jsonb_build_object('prenom', pr.prenom, 'nom', pr.nom) from public.profiles pr where pr.id = p.practitioner_id),
          'etablissement', (select h.nom from public.hospitals h where h.id = p.hospital_id),
          'lignes', coalesce((select jsonb_agg(to_jsonb(i) order by i.date_debut) from public.prescription_items i where i.prescription_id = p.id), '[]')
        ) order by p.date_prescription desc, p.created_at desc)
      from public.prescriptions p where p.patient_id = p_patient_id
    ), '[]'),
    -- Prises prévues ces 30 derniers jours : le médecin juge si le traitement est bien suivi.
    'observance', (
      select jsonb_build_object(
        'prevues', count(*),
        'prises', count(*) filter (where statut = 'pris'),
        'non_prises', count(*) filter (where statut = 'non_pris')
      )
      from public.medication_intakes
      where patient_id = p_patient_id and prevu_a between now() - interval '30 days' and now()
    ),
    -- Le patient voit tous ses rendez-vous ; un médecin, seulement les siens avec ce patient.
    'rendez_vous', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', a.id, 'statut', a.statut, 'motif', a.motif, 'debut', s.debut,
          'etablissement', h.nom,
          'medecin', (select jsonb_build_object('prenom', pr.prenom, 'nom', pr.nom) from public.profiles pr where pr.id = a.practitioner_id),
          'consultation_id', (select c.id from public.consultations c where c.appointment_id = a.id)
        ) order by s.debut desc)
      from public.appointments a
      join public.slots s on s.id = a.slot_id
      join public.hospitals h on h.id = a.hospital_id
      where a.patient_id = p_patient_id and (v_uid = p_patient_id or a.practitioner_id = v_uid)
    ), '[]')
  ) into v_record;

  if p_patient_id <> v_uid then
    insert into public.audit_log (actor_id, action, table_name, record_id, patient_id)
    values (v_uid, 'READ', 'dossier', p_patient_id::text, p_patient_id);
  end if;

  return v_record;
end;
$$;
