-- =============================================================================
-- Fonctions serveur, triggers et actions métier (appelées via supabase.rpc()).
-- Les fonctions "security definer" contournent la RLS : chacune vérifie donc
-- elle-même les droits de l'appelant avant d'agir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Aides utilisées par les règles RLS
-- -----------------------------------------------------------------------------

create function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_practitioner_of(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.care_relationships cr
    join public.profiles p on p.id = cr.practitioner_id
    where cr.patient_id = p_patient_id
      and cr.practitioner_id = auth.uid()
      and p.role = 'medecin'
  )
$$;

-- Lecture du contenu médical : le patient lui-même ou un médecin qui le suit.
-- Ni le secrétariat ni l'administration n'y ont accès.
create function public.can_read_medical(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_patient_id = auth.uid() or public.is_practitioner_of(p_patient_id)
$$;

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription.
-- Le rôle vaut toujours "patient" : il n'est jamais lu depuis les métadonnées
-- envoyées par le client.
-- -----------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, prenom, nom)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    coalesce(new.raw_user_meta_data ->> 'nom', '')
  );
  insert into public.patients (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Administration des comptes
-- -----------------------------------------------------------------------------

create function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Action réservée aux administrateurs' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Un administrateur ne peut pas modifier son propre rôle';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'Utilisateur introuvable';
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id)
  values (auth.uid(), 'UPDATE_ROLE:' || p_role, 'profiles', p_user_id::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- Créneaux : génération en série (secrétariat / admin)
-- p_jours : jours ISO de la semaine (1 = lundi … 7 = dimanche). Heures de Paris.
-- -----------------------------------------------------------------------------

create function public.generate_slots(
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
  if public.current_app_role() not in ('secretaire', 'admin') then
    raise exception 'Action réservée au secrétariat' using errcode = '42501';
  end if;
  if p_duree_minutes not between 5 and 240 then
    raise exception 'Durée de créneau invalide';
  end if;
  if p_date_fin < p_date_debut or p_date_fin - p_date_debut > 180 then
    raise exception 'Période invalide (180 jours maximum)';
  end if;

  insert into public.slots (practitioner_id, debut, fin)
  select
    p_practitioner_id,
    (d::date + t::time) at time zone 'Europe/Paris',
    (d::date + t::time + make_interval(mins => p_duree_minutes)) at time zone 'Europe/Paris'
  from generate_series(p_date_debut, p_date_fin, interval '1 day') d
  cross join generate_series(
    timestamp '2000-01-01' + p_heure_debut,
    timestamp '2000-01-01' + p_heure_fin - make_interval(mins => p_duree_minutes),
    make_interval(mins => p_duree_minutes)
  ) t
  where extract(isodow from d)::int = any (p_jours)
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rendez-vous
-- -----------------------------------------------------------------------------

-- Réservation. Sans p_patient_id : le patient réserve pour lui-même.
-- Avec p_patient_id : le secrétariat réserve pour un patient.
create function public.book_appointment(
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
  if p_patient_id is null then
    if v_role is distinct from 'patient' then
      raise exception 'Seul un patient peut réserver pour lui-même' using errcode = '42501';
    end if;
    v_patient_id := auth.uid();
  else
    if v_role not in ('secretaire', 'admin') then
      raise exception 'Seul le secrétariat peut réserver pour un patient' using errcode = '42501';
    end if;
    v_patient_id := p_patient_id;
  end if;

  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception 'Créneau introuvable';
  end if;
  if v_slot.statut <> 'libre' then
    raise exception 'Ce créneau n''est plus disponible';
  end if;
  if v_slot.debut <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;

  update public.slots set statut = 'reserve' where id = p_slot_id;

  insert into public.appointments (slot_id, patient_id, practitioner_id, motif)
  values (p_slot_id, v_patient_id, v_slot.practitioner_id, nullif(trim(p_motif), ''))
  returning * into v_appt;

  -- Prendre rendez-vous donne au médecin l'accès au dossier du patient.
  insert into public.care_relationships (patient_id, practitioner_id)
  values (v_patient_id, v_slot.practitioner_id)
  on conflict do nothing;

  return v_appt;
end;
$$;

create function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_appt public.appointments;
  v_debut timestamptz;
begin
  select a.* into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if not found then
    raise exception 'Rendez-vous introuvable';
  end if;

  if not (v_role in ('secretaire', 'admin') or v_appt.patient_id = auth.uid()) then
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

-- Après la consultation : le médecin concerné ou le secrétariat note "honoré" ou "absent".
create function public.set_appointment_status(p_appointment_id uuid, p_statut public.appointment_status)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_appt public.appointments;
begin
  if p_statut not in ('honore', 'absent') then
    raise exception 'Statut invalide : utilisez cancel_appointment pour annuler';
  end if;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Rendez-vous introuvable';
  end if;
  if not (v_role in ('secretaire', 'admin') or (v_role = 'medecin' and v_appt.practitioner_id = auth.uid())) then
    raise exception 'Vous ne pouvez pas modifier ce rendez-vous' using errcode = '42501';
  end if;
  if v_appt.statut = 'annule' then
    raise exception 'Ce rendez-vous a été annulé';
  end if;

  update public.appointments set statut = p_statut, updated_at = now() where id = p_appointment_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Plan de prise des médicaments
-- -----------------------------------------------------------------------------

-- Génère une prise par jour et par horaire dès qu'une ligne d'ordonnance est créée.
create function public.generate_intakes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.medication_intakes (prescription_item_id, patient_id, prevu_a)
  select
    new.id,
    p.patient_id,
    (d::date + h) at time zone 'Europe/Paris'
  from public.prescriptions p
  cross join generate_series(new.date_debut, new.date_fin, interval '1 day') d
  cross join unnest(new.horaires) h
  where p.id = new.prescription_id
  on conflict do nothing;
  return new;
end;
$$;

create trigger prescription_items_generate_intakes
  after insert on public.prescription_items
  for each row execute function public.generate_intakes();

-- Quand une ordonnance est arrêtée ou annulée, les prises futures disparaissent.
create function public.cleanup_intakes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.statut <> 'active' and old.statut = 'active' then
    delete from public.medication_intakes mi
    using public.prescription_items pi
    where mi.prescription_item_id = pi.id
      and pi.prescription_id = new.id
      and mi.statut = 'a_prendre'
      and mi.prevu_a > now();
  end if;
  return new;
end;
$$;

create trigger prescriptions_cleanup_intakes
  after update of statut on public.prescriptions
  for each row execute function public.cleanup_intakes();

-- Le patient indique s'il a pris son médicament.
create function public.record_intake(p_intake_id uuid, p_statut public.intake_status)
returns public.medication_intakes
language plpgsql security definer set search_path = ''
as $$
declare
  v_intake public.medication_intakes;
begin
  if p_statut not in ('pris', 'non_pris') then
    raise exception 'Statut invalide';
  end if;

  update public.medication_intakes
  set statut = p_statut,
      pris_a = case when p_statut = 'pris' then now() end
  where id = p_intake_id
    and patient_id = auth.uid()
    and prevu_a <= now() + interval '12 hours'
  returning * into v_intake;

  if not found then
    raise exception 'Prise introuvable ou trop éloignée dans le futur';
  end if;
  return v_intake;
end;
$$;

-- -----------------------------------------------------------------------------
-- Journal d'audit
-- -----------------------------------------------------------------------------

-- Trace toute écriture sur les données sensibles.
create function public.audit_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, action, table_name, record_id, patient_id)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    v_row ->> 'id',
    coalesce(v_row ->> 'patient_id', case when tg_table_name = 'patients' then v_row ->> 'id' end)::uuid
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'medical_profiles', 'care_relationships', 'appointments',
    'allergies', 'medical_history', 'vaccinations', 'documents', 'prescriptions'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_write()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- Lecture d'un dossier complet (fiche patient côté médecin). Chaque consultation
-- par un soignant est tracée : PostgreSQL ne sait pas tracer un simple SELECT.
create function public.get_patient_record(p_patient_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_record jsonb;
begin
  if not public.can_read_medical(p_patient_id) then
    raise exception 'Accès au dossier refusé' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'identite', (
      select to_jsonb(x) from (
        select pr.prenom, pr.nom, pa.date_naissance, pa.sexe
        from public.patients pa join public.profiles pr on pr.id = pa.id
        where pa.id = p_patient_id
      ) x
    ),
    'profil_medical', (select to_jsonb(m) - 'patient_id' from public.medical_profiles m where m.patient_id = p_patient_id),
    'allergies', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.allergies a where a.patient_id = p_patient_id), '[]'),
    'antecedents', coalesce((select jsonb_agg(to_jsonb(h) order by h.date_evenement) from public.medical_history h where h.patient_id = p_patient_id), '[]'),
    'vaccinations', coalesce((select jsonb_agg(to_jsonb(v) order by v.date_administration) from public.vaccinations v where v.patient_id = p_patient_id), '[]'),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.documents d where d.patient_id = p_patient_id), '[]'),
    'ordonnances', coalesce((
      select jsonb_agg(
        to_jsonb(p) || jsonb_build_object(
          'lignes', coalesce((select jsonb_agg(to_jsonb(i)) from public.prescription_items i where i.prescription_id = p.id), '[]')
        ) order by p.date_prescription desc)
      from public.prescriptions p where p.patient_id = p_patient_id
    ), '[]')
  ) into v_record;

  if p_patient_id <> auth.uid() then
    insert into public.audit_log (actor_id, action, table_name, record_id, patient_id)
    values (auth.uid(), 'READ', 'dossier', p_patient_id::text, p_patient_id);
  end if;

  return v_record;
end;
$$;

-- Export RGPD : toutes les données du patient connecté.
create function public.export_my_data()
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
    'rendez_vous', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object('debut', s.debut, 'fin', s.fin) order by s.debut)
      from public.appointments a join public.slots s on s.id = a.slot_id
      where a.patient_id = v_uid
    ), '[]'),
    'prises', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.prevu_a)
      from public.medication_intakes m where m.patient_id = v_uid
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
