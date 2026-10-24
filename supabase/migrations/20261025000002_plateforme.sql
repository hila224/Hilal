-- =============================================================================
-- Plateforme multi-établissements
--
--  - Les établissements (hôpitaux, cliniques, centres de santé) ouvrent leur
--    compte ; l'administrateur de la plateforme les valide (numéro d'agrément).
--  - Un établissement validé enregistre ses médecins et se porte garant de leur
--    inscription à l'Ordre des médecins (numéro obligatoire).
--  - Services, tarifs (en francs guinéens), médecins et créneaux appartiennent à
--    un établissement ; le patient choisit l'établissement de son rendez-vous.
--  - Le patient peut désigner un médecin traitant et échanger des messages avec
--    les médecins qui le suivent.
--
-- Rôles : patient, medecin, gestionnaire (d'un établissement), admin (plateforme).
-- L'admin plateforme valide les établissements mais n'a accès à aucune donnée médicale.
-- =============================================================================

create type public.hospital_type as enum ('hopital_public', 'clinique_privee', 'centre_sante', 'cabinet');
create type public.hospital_status as enum ('en_attente', 'valide', 'refuse', 'suspendu');

-- -----------------------------------------------------------------------------
-- Établissements
-- -----------------------------------------------------------------------------

-- FHIR : Organization
create table public.hospitals (
  id                uuid primary key default gen_random_uuid(),
  nom               text not null check (length(trim(nom)) between 2 and 120),
  type              public.hospital_type not null,
  ville             text not null,
  commune           text,
  adresse           text,
  telephone         text check (telephone is null or telephone ~ '^\+224[0-9]{9}$'),
  email             text,
  description       text,
  horaires          text,
  urgences_24h      boolean not null default false,
  paiements         text[] not null default array['especes']
                    check (paiements <@ array['especes', 'orange_money', 'mtn_momo', 'carte', 'assurance']),
  numero_agrement   text not null check (length(trim(numero_agrement)) >= 3),
  statut            public.hospital_status not null default 'en_attente',
  motif_refus       text,
  created_at        timestamptz not null default now(),
  valide_at         timestamptz
);
create index on public.hospitals (statut, ville);

-- Comptes qui gèrent un établissement.
create table public.hospital_members (
  hospital_id  uuid not null references public.hospitals (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (hospital_id, user_id)
);
create index on public.hospital_members (user_id);

-- Services et médecins appartiennent désormais à un établissement.
alter table public.services add column hospital_id uuid references public.hospitals (id) on delete cascade;
alter table public.services drop constraint services_nom_key;

-- Médecin : numéro d'inscription à l'Ordre, établissement qui s'en porte garant.
alter table public.practitioners
  add column numero_ordre text,
  add column garant_hospital_id uuid references public.hospitals (id) on delete set null,
  add column garanti_at timestamptz;

-- Un médecin peut exercer dans plusieurs établissements (FHIR : PractitionerRole).
create table public.hospital_doctors (
  hospital_id      uuid not null references public.hospitals (id) on delete cascade,
  practitioner_id  uuid not null references public.practitioners (id) on delete cascade,
  service_id       uuid not null references public.services (id) on delete cascade,
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  primary key (hospital_id, practitioner_id)
);
create index on public.hospital_doctors (practitioner_id);

-- Médecin enregistré par un établissement mais qui n'a pas encore de compte :
-- le compte devient « médecin » automatiquement à son inscription avec cet e-mail.
create table public.doctor_invitations (
  hospital_id   uuid not null references public.hospitals (id) on delete cascade,
  email         text not null check (email = lower(email)),
  prenom        text not null,
  nom           text not null,
  specialite    text not null,
  numero_ordre  text not null,
  service_id    uuid not null references public.services (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (hospital_id, email)
);
create index on public.doctor_invitations (email);

-- Tarifs publiés par l'établissement, en francs guinéens (paiement sur place).
-- FHIR : ChargeItemDefinition
create table public.tarifs (
  id           uuid primary key default gen_random_uuid(),
  hospital_id  uuid not null references public.hospitals (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  libelle      text not null check (length(trim(libelle)) between 2 and 120),
  prix_gnf     integer not null check (prix_gnf between 0 and 1000000000),
  description  text,
  actif        boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on public.tarifs (hospital_id);

alter table public.slots add column hospital_id uuid references public.hospitals (id) on delete cascade;
alter table public.appointments add column hospital_id uuid references public.hospitals (id);

-- Médecin traitant choisi par le patient.
alter table public.patients add column medecin_traitant_id uuid references public.practitioners (id) on delete set null;

-- Messagerie patient ↔ médecin. FHIR : Communication
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  practitioner_id  uuid not null references public.practitioners (id) on delete cascade,
  auteur_id        uuid not null references public.profiles (id) on delete cascade,
  contenu          text not null check (length(trim(contenu)) between 1 and 2000),
  created_at       timestamptz not null default now(),
  lu_at            timestamptz,
  check (auteur_id in (patient_id, practitioner_id))
);
create index on public.messages (patient_id, practitioner_id, created_at);

-- -----------------------------------------------------------------------------
-- Reprise des données existantes : tout ce qui existait est rattaché à un
-- établissement de démonstration déjà validé.
-- -----------------------------------------------------------------------------
do $$
declare
  v_hospital uuid;
begin
  if exists (select 1 from public.services) or exists (select 1 from public.practitioners) then
    insert into public.hospitals (nom, type, ville, numero_agrement, statut, valide_at)
    values ('Établissement de démonstration', 'hopital_public', 'Conakry', 'DEMO-0001', 'valide', now())
    returning id into v_hospital;

    update public.services set hospital_id = v_hospital;
    insert into public.hospital_doctors (hospital_id, practitioner_id, service_id)
    select v_hospital, id, service_id from public.practitioners;
    update public.practitioners set garant_hospital_id = v_hospital, garanti_at = now(), numero_ordre = 'DEMO-' || left(id::text, 8);
    update public.slots set hospital_id = v_hospital;
    update public.appointments set hospital_id = v_hospital;
  end if;
end;
$$;

alter table public.services alter column hospital_id set not null;
alter table public.services add constraint services_hospital_nom_key unique (hospital_id, nom);
alter table public.practitioners drop column service_id, drop column rpps;
alter table public.practitioners add constraint practitioners_numero_ordre_key unique (numero_ordre);
alter table public.slots alter column hospital_id set not null;
alter table public.appointments alter column hospital_id set not null;
create index on public.slots (hospital_id, debut);
create index on public.appointments (hospital_id);

-- -----------------------------------------------------------------------------
-- Aides pour les règles d'accès
-- -----------------------------------------------------------------------------

-- Le compte connecté gère cet établissement (quel que soit son statut).
create function public.manages_hospital(p_hospital_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.hospital_members m
    join public.profiles p on p.id = m.user_id
    where m.hospital_id = p_hospital_id and m.user_id = auth.uid() and p.role = 'gestionnaire'
  )
$$;

-- … et cet établissement est validé (condition pour publier et accueillir des patients).
create function public.manages_valid_hospital(p_hospital_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.manages_hospital(p_hospital_id)
    and exists (select 1 from public.hospitals where id = p_hospital_id and statut = 'valide')
$$;

create function public.hospital_is_public(p_hospital_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.hospitals where id = p_hospital_id and statut = 'valide')
$$;

-- Le patient a (eu) un rendez-vous dans un établissement géré par le compte connecté.
create function public.is_patient_of_my_hospital(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
    where a.patient_id = p_patient_id and public.manages_hospital(a.hospital_id)
  )
$$;

-- Un patient peut écrire à un médecin qui le suit ou à son médecin traitant.
create function public.can_message(p_patient_id uuid, p_practitioner_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.care_relationships
    where patient_id = p_patient_id and practitioner_id = p_practitioner_id
  ) or exists (
    select 1 from public.patients
    where id = p_patient_id and medecin_traitant_id = p_practitioner_id
  )
$$;

-- -----------------------------------------------------------------------------
-- Inscription : un compte invité par un établissement devient médecin
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_invitation public.doctor_invitations;
begin
  select * into v_invitation
  from public.doctor_invitations
  where email = lower(new.email)
  order by created_at
  limit 1;

  if not found then
    -- Inscription d'un établissement : le compte devient gestionnaire d'un
    -- établissement « en attente », sans aucun droit tant que l'admin ne l'a pas validé.
    if new.raw_user_meta_data ->> 'type_compte' = 'etablissement' then
      insert into public.profiles (id, role, prenom, nom)
      values (
        new.id,
        'gestionnaire',
        coalesce(new.raw_user_meta_data ->> 'prenom', ''),
        coalesce(new.raw_user_meta_data ->> 'nom', '')
      );
      with h as (
        insert into public.hospitals (nom, type, ville, commune, telephone, numero_agrement)
        values (
          trim(new.raw_user_meta_data #>> '{etablissement,nom}'),
          (new.raw_user_meta_data #>> '{etablissement,type}')::public.hospital_type,
          trim(new.raw_user_meta_data #>> '{etablissement,ville}'),
          nullif(trim(new.raw_user_meta_data #>> '{etablissement,commune}'), ''),
          nullif(new.raw_user_meta_data #>> '{etablissement,telephone}', ''),
          trim(new.raw_user_meta_data #>> '{etablissement,numero_agrement}')
        )
        returning id
      )
      insert into public.hospital_members (hospital_id, user_id) select id, new.id from h;
      return new;
    end if;

    insert into public.profiles (id, prenom, nom)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'prenom', ''),
      coalesce(new.raw_user_meta_data ->> 'nom', '')
    );
    insert into public.patients (id) values (new.id);
    return new;
  end if;

  -- Médecin enregistré à l'avance par un ou plusieurs établissements.
  insert into public.profiles (id, role, prenom, nom)
  values (new.id, 'medecin', v_invitation.prenom, v_invitation.nom);
  insert into public.practitioners (id, specialite, numero_ordre, garant_hospital_id, garanti_at)
  values (new.id, v_invitation.specialite, v_invitation.numero_ordre, v_invitation.hospital_id, now());
  insert into public.hospital_doctors (hospital_id, practitioner_id, service_id)
  select hospital_id, new.id, service_id from public.doctor_invitations where email = lower(new.email)
  on conflict do nothing;
  delete from public.doctor_invitations where email = lower(new.email);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Établissements : inscription et validation
-- -----------------------------------------------------------------------------

create function public.register_hospital(
  p_nom text,
  p_type public.hospital_type,
  p_ville text,
  p_numero_agrement text,
  p_commune text default null,
  p_adresse text default null,
  p_telephone text default null,
  p_description text default null
)
returns public.hospitals
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_hospital public.hospitals;
begin
  if v_role = 'patient' then
    -- Un compte déjà utilisé comme patient ne peut pas devenir un compte d'établissement.
    if exists (select 1 from public.appointments where patient_id = v_uid)
       or exists (select 1 from public.care_relationships where patient_id = v_uid) then
      raise exception 'Utilisez un compte dédié à l''établissement, distinct de votre compte patient';
    end if;
    update public.profiles set role = 'gestionnaire' where id = v_uid;
    delete from public.patients where id = v_uid;
  elsif v_role is distinct from 'gestionnaire' then
    raise exception 'Ce compte ne peut pas inscrire d''établissement' using errcode = '42501';
  end if;

  insert into public.hospitals (nom, type, ville, commune, adresse, telephone, numero_agrement, description)
  values (trim(p_nom), p_type, trim(p_ville), nullif(trim(p_commune), ''), nullif(trim(p_adresse), ''),
          p_telephone, trim(p_numero_agrement), nullif(trim(p_description), ''))
  returning * into v_hospital;

  insert into public.hospital_members (hospital_id, user_id) values (v_hospital.id, v_uid);

  insert into public.audit_log (actor_id, action, table_name, record_id)
  values (v_uid, 'REGISTER', 'hospitals', v_hospital.id::text);
  return v_hospital;
end;
$$;

-- Décision de l'administrateur de la plateforme.
create function public.review_hospital(p_hospital_id uuid, p_statut public.hospital_status, p_motif text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Action réservée à l''administrateur de la plateforme' using errcode = '42501';
  end if;
  if p_statut = 'en_attente' then
    raise exception 'Décision invalide';
  end if;

  update public.hospitals
  set statut = p_statut,
      motif_refus = case when p_statut in ('refuse', 'suspendu') then nullif(trim(p_motif), '') end,
      valide_at = case when p_statut = 'valide' then coalesce(valide_at, now()) else valide_at end
  where id = p_hospital_id;
  if not found then
    raise exception 'Établissement introuvable';
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id)
  values (auth.uid(), 'REVIEW:' || p_statut, 'hospitals', p_hospital_id::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- Médecins : enregistrement par un établissement validé, qui s'en porte garant
-- Renvoie « affilie » (compte existant) ou « invite » (le compte sera créé à l'inscription).
-- -----------------------------------------------------------------------------

create function public.add_doctor(
  p_hospital_id uuid,
  p_email text,
  p_prenom text,
  p_nom text,
  p_specialite text,
  p_numero_ordre text,
  p_service_id uuid
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_numero text := upper(trim(p_numero_ordre));
  v_user_id uuid;
  v_role public.app_role;
  v_holder uuid;
begin
  if not public.manages_valid_hospital(p_hospital_id) then
    raise exception 'Seul un établissement validé peut enregistrer des médecins' using errcode = '42501';
  end if;
  if length(coalesce(v_numero, '')) < 3 then
    raise exception 'Le numéro d''inscription à l''Ordre des médecins est obligatoire';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and hospital_id = p_hospital_id) then
    raise exception 'Service inconnu dans cet établissement';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email;

  -- Un numéro de l'Ordre ne peut appartenir qu'à un seul médecin.
  select id into v_holder from public.practitioners where numero_ordre = v_numero;
  if v_holder is not null and v_holder is distinct from v_user_id then
    raise exception 'Ce numéro de l''Ordre est déjà associé à un autre médecin';
  end if;

  if v_user_id is null then
    insert into public.doctor_invitations (hospital_id, email, prenom, nom, specialite, numero_ordre, service_id, created_by)
    values (p_hospital_id, v_email, trim(p_prenom), trim(p_nom), trim(p_specialite), v_numero, p_service_id, auth.uid())
    on conflict (hospital_id, email) do update
      set prenom = excluded.prenom, nom = excluded.nom, specialite = excluded.specialite,
          numero_ordre = excluded.numero_ordre, service_id = excluded.service_id;
    return 'invite';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role = 'patient' then
    if exists (select 1 from public.appointments where patient_id = v_user_id)
       or exists (select 1 from public.care_relationships where patient_id = v_user_id) then
      raise exception 'Ce compte est utilisé comme compte patient : le médecin doit créer un compte professionnel séparé';
    end if;
    update public.profiles set role = 'medecin', prenom = trim(p_prenom), nom = trim(p_nom) where id = v_user_id;
    delete from public.patients where id = v_user_id;
  elsif v_role is distinct from 'medecin' then
    raise exception 'Ce compte ne peut pas devenir un compte médecin';
  end if;

  insert into public.practitioners (id, specialite, numero_ordre, garant_hospital_id, garanti_at)
  values (v_user_id, trim(p_specialite), v_numero, p_hospital_id, now())
  on conflict (id) do update set numero_ordre = coalesce(public.practitioners.numero_ordre, excluded.numero_ordre);

  insert into public.hospital_doctors (hospital_id, practitioner_id, service_id)
  values (p_hospital_id, v_user_id, p_service_id)
  on conflict (hospital_id, practitioner_id) do update set service_id = excluded.service_id, actif = true;

  insert into public.audit_log (actor_id, action, table_name, record_id)
  values (auth.uid(), 'ADD_DOCTOR', 'hospital_doctors', p_hospital_id::text || '/' || v_user_id::text);
  return 'affilie';
end;
$$;

-- -----------------------------------------------------------------------------
-- Créneaux : par établissement, pour un médecin qui y exerce
-- -----------------------------------------------------------------------------

drop function public.generate_slots(uuid, date, date, time, time, int, int[]);

create function public.generate_slots(
  p_hospital_id uuid,
  p_practitioner_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_heure_debut time,
  p_heure_fin time,
  p_duree_minutes int,
  p_jours int[] default array[1, 2, 3, 4, 5]
)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.manages_valid_hospital(p_hospital_id) then
    raise exception 'Action réservée à un établissement validé' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.hospital_doctors
    where hospital_id = p_hospital_id and practitioner_id = p_practitioner_id and actif
  ) then
    raise exception 'Ce médecin n''exerce pas dans cet établissement';
  end if;
  if p_duree_minutes not between 5 and 240 then
    raise exception 'Durée de créneau invalide';
  end if;
  if p_date_fin < p_date_debut or p_date_fin - p_date_debut > 180 then
    raise exception 'Période invalide (180 jours maximum)';
  end if;

  -- Un médecin ne peut pas avoir deux créneaux qui se chevauchent, même dans deux établissements.
  insert into public.slots (hospital_id, practitioner_id, debut, fin)
  select
    p_hospital_id,
    p_practitioner_id,
    (d::date + t::time) at time zone public.app_timezone(),
    (d::date + t::time + make_interval(mins => p_duree_minutes)) at time zone public.app_timezone()
  from generate_series(p_date_debut, p_date_fin, interval '1 day') d
  cross join generate_series(
    timestamp '2000-01-01' + p_heure_debut,
    timestamp '2000-01-01' + p_heure_fin - make_interval(mins => p_duree_minutes),
    make_interval(mins => p_duree_minutes)
  ) t
  where extract(isodow from d)::int = any (p_jours)
    and (d::date + t::time) at time zone public.app_timezone() > now()
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rendez-vous : dans l'établissement choisi par le patient
-- -----------------------------------------------------------------------------

create or replace function public.book_appointment(
  p_slot_id uuid,
  p_motif text default null,
  p_patient_id uuid default null
)
returns public.appointments
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_patient_id uuid;
  v_slot public.slots;
  v_appt public.appointments;
begin
  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception 'Créneau introuvable';
  end if;

  if p_patient_id is null then
    if v_role is distinct from 'patient' then
      raise exception 'Seul un patient peut réserver pour lui-même' using errcode = '42501';
    end if;
    v_patient_id := auth.uid();
  else
    -- L'accueil de l'établissement peut réserver pour un patient.
    if not public.manages_valid_hospital(v_slot.hospital_id) then
      raise exception 'Seul l''établissement peut réserver pour un patient' using errcode = '42501';
    end if;
    v_patient_id := p_patient_id;
  end if;

  if not public.hospital_is_public(v_slot.hospital_id) then
    raise exception 'Cet établissement n''accepte pas de rendez-vous pour le moment';
  end if;
  if not exists (
    select 1 from public.hospital_doctors
    where hospital_id = v_slot.hospital_id and practitioner_id = v_slot.practitioner_id and actif
  ) then
    raise exception 'Ce médecin ne consulte plus dans cet établissement';
  end if;
  if v_slot.statut <> 'libre' then
    raise exception 'Ce créneau n''est plus disponible';
  end if;
  if v_slot.debut <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;

  update public.slots set statut = 'reserve' where id = p_slot_id;

  insert into public.appointments (slot_id, patient_id, practitioner_id, hospital_id, motif)
  values (p_slot_id, v_patient_id, v_slot.practitioner_id, v_slot.hospital_id, nullif(trim(p_motif), ''))
  returning * into v_appt;

  -- Prendre rendez-vous donne au médecin l'accès au dossier du patient.
  insert into public.care_relationships (patient_id, practitioner_id)
  values (v_patient_id, v_slot.practitioner_id)
  on conflict do nothing;

  return v_appt;
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_debut timestamptz;
begin
  select a.* into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if not found then
    raise exception 'Rendez-vous introuvable';
  end if;

  if not (v_appt.patient_id = auth.uid() or public.manages_hospital(v_appt.hospital_id)) then
    raise exception 'Vous ne pouvez pas annuler ce rendez-vous' using errcode = '42501';
  end if;
  if v_appt.statut <> 'confirme' then
    raise exception 'Seul un rendez-vous confirmé peut être annulé';
  end if;

  select debut into v_debut from public.slots where id = v_appt.slot_id;
  if v_debut <= now() then
    raise exception 'Ce rendez-vous est déjà passé';
  end if;

  update public.appointments set statut = 'annule', updated_at = now() where id = p_appointment_id;
  update public.slots set statut = 'libre' where id = v_appt.slot_id;
end;
$$;

create or replace function public.set_appointment_status(p_appointment_id uuid, p_statut public.appointment_status)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  if p_statut not in ('honore', 'absent') then
    raise exception 'Statut invalide : utilisez cancel_appointment pour annuler';
  end if;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Rendez-vous introuvable';
  end if;
  if not (v_appt.practitioner_id = auth.uid() or public.manages_hospital(v_appt.hospital_id)) then
    raise exception 'Vous ne pouvez pas modifier ce rendez-vous' using errcode = '42501';
  end if;
  if v_appt.statut = 'annule' then
    raise exception 'Ce rendez-vous a été annulé';
  end if;

  update public.appointments set statut = p_statut, updated_at = now() where id = p_appointment_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Médecin traitant et messagerie
-- -----------------------------------------------------------------------------

-- Le patient choisit (ou retire, avec null) son médecin traitant ; ce médecin
-- obtient l'accès à son dossier.
create function public.set_medecin_traitant(p_practitioner_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if public.current_app_role() is distinct from 'patient' then
    raise exception 'Action réservée aux patients' using errcode = '42501';
  end if;
  if p_practitioner_id is not null and not exists (
    select 1 from public.hospital_doctors hd
    join public.hospitals h on h.id = hd.hospital_id
    where hd.practitioner_id = p_practitioner_id and hd.actif and h.statut = 'valide'
  ) then
    raise exception 'Ce médecin n''exerce dans aucun établissement validé';
  end if;

  update public.patients set medecin_traitant_id = p_practitioner_id where id = v_uid;
  if p_practitioner_id is not null then
    insert into public.care_relationships (patient_id, practitioner_id)
    values (v_uid, p_practitioner_id)
    on conflict do nothing;
  end if;
end;
$$;

-- Marque comme lus les messages reçus dans une conversation.
create function public.mark_messages_read(p_patient_id uuid, p_practitioner_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.messages
  set lu_at = now()
  where patient_id = p_patient_id
    and practitioner_id = p_practitioner_id
    and lu_at is null
    and auteur_id <> auth.uid()
    and auth.uid() in (p_patient_id, p_practitioner_id)
$$;

create trigger messages_audit
  after insert or update or delete on public.messages
  for each row execute function public.audit_write();

-- -----------------------------------------------------------------------------
-- Export : ajout des messages et du médecin traitant
-- -----------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_export jsonb;
begin
  if public.current_app_role() is distinct from 'patient' then
    raise exception 'Export réservé aux patients' using errcode = '42501';
  end if;

  v_export := public.get_patient_record(v_uid) || jsonb_build_object(
    'exporte_le', now(),
    'compte', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'preferences', (select to_jsonb(pa) from public.patients pa where pa.id = v_uid),
    'rendez_vous', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object('debut', s.debut, 'fin', s.fin, 'etablissement', h.nom) order by s.debut)
      from public.appointments a
      join public.slots s on s.id = a.slot_id
      join public.hospitals h on h.id = a.hospital_id
      where a.patient_id = v_uid
    ), '[]'),
    'prises', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.prevu_a)
      from public.medication_intakes m where m.patient_id = v_uid
    ), '[]'),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.messages m where m.patient_id = v_uid
    ), '[]'),
    'acces_au_dossier', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.at)
      from public.audit_log l where l.patient_id = v_uid
    ), '[]')
  );

  insert into public.audit_log (actor_id, action, table_name, record_id, patient_id)
  values (v_uid, 'EXPORT', 'dossier', v_uid::text, v_uid);

  return v_export;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits SQL
-- -----------------------------------------------------------------------------

revoke all on public.hospitals, public.hospital_members, public.hospital_doctors,
  public.doctor_invitations, public.tarifs, public.messages from anon;

revoke insert, update, delete on public.hospitals, public.hospital_members,
  public.doctor_invitations, public.practitioners from authenticated;
-- L'établissement modifie sa fiche, mais jamais son statut ni son agrément.
grant update (nom, type, ville, commune, adresse, telephone, email, description, horaires, urgences_24h, paiements)
  on public.hospitals to authenticated;
grant delete on public.doctor_invitations to authenticated;

revoke insert, update, delete on public.hospital_doctors from authenticated;
grant update (actif, service_id) on public.hospital_doctors to authenticated;

revoke insert, update, delete on public.messages from authenticated;
grant insert (patient_id, practitioner_id, auteur_id, contenu) on public.messages to authenticated;

revoke execute on function
  public.manages_hospital(uuid), public.manages_valid_hospital(uuid), public.hospital_is_public(uuid),
  public.is_patient_of_my_hospital(uuid), public.can_message(uuid, uuid),
  public.register_hospital(text, public.hospital_type, text, text, text, text, text, text),
  public.review_hospital(uuid, public.hospital_status, text),
  public.add_doctor(uuid, text, text, text, text, text, uuid),
  public.generate_slots(uuid, uuid, date, date, time, time, int, int[]),
  public.set_medecin_traitant(uuid), public.mark_messages_read(uuid, uuid)
from public, anon;
grant execute on function
  public.manages_hospital(uuid), public.manages_valid_hospital(uuid), public.hospital_is_public(uuid),
  public.is_patient_of_my_hospital(uuid), public.can_message(uuid, uuid),
  public.register_hospital(text, public.hospital_type, text, text, text, text, text, text),
  public.review_hospital(uuid, public.hospital_status, text),
  public.add_doctor(uuid, text, text, text, text, text, uuid),
  public.generate_slots(uuid, uuid, date, date, time, time, int, int[]),
  public.set_medecin_traitant(uuid), public.mark_messages_read(uuid, uuid)
to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Règles d'accès (RLS)
-- -----------------------------------------------------------------------------

alter table public.hospitals enable row level security;
alter table public.hospital_members enable row level security;
alter table public.hospital_doctors enable row level security;
alter table public.doctor_invitations enable row level security;
alter table public.tarifs enable row level security;
alter table public.messages enable row level security;

-- Établissements : les validés sont publics ; les autres visibles par leurs gestionnaires et l'admin.
create policy "établissements visibles" on public.hospitals for select to authenticated
using (statut = 'valide' or public.manages_hospital(id) or public.current_app_role() = 'admin');
create policy "gestionnaire modifie sa fiche" on public.hospitals for update to authenticated
using (public.manages_hospital(id)) with check (public.manages_hospital(id));

create policy "membres visibles" on public.hospital_members for select to authenticated
using (user_id = auth.uid() or public.manages_hospital(hospital_id) or public.current_app_role() = 'admin');

-- Services : publics si l'établissement est validé ; gérés par l'établissement.
drop policy "services visibles" on public.services;
drop policy "admin gère les services" on public.services;
create policy "services visibles" on public.services for select to authenticated
using (public.hospital_is_public(hospital_id) or public.manages_hospital(hospital_id));
create policy "établissement gère ses services" on public.services for all to authenticated
using (public.manages_hospital(hospital_id)) with check (public.manages_hospital(hospital_id));

-- Médecins : annuaire visible ; créés uniquement via add_doctor / invitation.
drop policy "admin gère les médecins" on public.practitioners;

create policy "affiliations visibles" on public.hospital_doctors for select to authenticated
using (
  public.hospital_is_public(hospital_id)
  or public.manages_hospital(hospital_id)
  or practitioner_id = auth.uid()
);
create policy "établissement gère ses médecins" on public.hospital_doctors for update to authenticated
using (public.manages_hospital(hospital_id)) with check (public.manages_hospital(hospital_id));

create policy "invitations visibles" on public.doctor_invitations for select to authenticated
using (public.manages_hospital(hospital_id));
create policy "établissement retire une invitation" on public.doctor_invitations for delete to authenticated
using (public.manages_hospital(hospital_id));

create policy "tarifs visibles" on public.tarifs for select to authenticated
using ((actif and public.hospital_is_public(hospital_id)) or public.manages_hospital(hospital_id));
create policy "établissement gère ses tarifs" on public.tarifs for all to authenticated
using (public.manages_hospital(hospital_id)) with check (public.manages_hospital(hospital_id));

-- Créneaux : gérés par l'établissement, pour ses médecins actifs.
drop policy "créneaux visibles" on public.slots;
drop policy "secrétariat gère les créneaux" on public.slots;
create policy "créneaux visibles" on public.slots for select to authenticated
using (public.hospital_is_public(hospital_id) or public.manages_hospital(hospital_id) or practitioner_id = auth.uid());
create policy "établissement gère ses créneaux" on public.slots for all to authenticated
using (public.manages_valid_hospital(hospital_id))
with check (
  public.manages_valid_hospital(hospital_id)
  and exists (
    select 1 from public.hospital_doctors hd
    where hd.hospital_id = slots.hospital_id and hd.practitioner_id = slots.practitioner_id and hd.actif
  )
);

-- Rendez-vous : le patient, le médecin, l'établissement concerné. Plus d'accès global.
drop policy "rendez-vous visibles" on public.appointments;
create policy "rendez-vous visibles" on public.appointments for select to authenticated
using (patient_id = auth.uid() or practitioner_id = auth.uid() or public.manages_hospital(hospital_id));

-- Identité des patients : l'établissement ne voit que ceux qui y ont pris rendez-vous.
drop policy "identité patient visible" on public.patients;
create policy "identité patient visible" on public.patients for select to authenticated
using (id = auth.uid() or public.is_practitioner_of(id) or public.is_patient_of_my_hospital(id));

drop policy "profils visibles" on public.profiles;
create policy "profils visibles" on public.profiles for select to authenticated
using (
  id = auth.uid()
  or role = 'medecin'                       -- annuaire des médecins
  or public.is_practitioner_of(id)
  or public.is_patient_of_my_hospital(id)
  or public.current_app_role() = 'admin'    -- noms des responsables d'établissement à valider
);

drop policy "liens de prise en charge visibles" on public.care_relationships;
drop policy "admin gère les prises en charge" on public.care_relationships;
create policy "liens de prise en charge visibles" on public.care_relationships for select to authenticated
using (patient_id = auth.uid() or practitioner_id = auth.uid());

-- Messages : seulement les deux interlocuteurs.
create policy "messages visibles" on public.messages for select to authenticated
using (patient_id = auth.uid() or practitioner_id = auth.uid());
create policy "envoyer un message" on public.messages for insert to authenticated
with check (
  auteur_id = auth.uid()
  and (
    (patient_id = auth.uid() and public.can_message(patient_id, practitioner_id))
    or (practitioner_id = auth.uid() and public.is_practitioner_of(patient_id))
  )
);
