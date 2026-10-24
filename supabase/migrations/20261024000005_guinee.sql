-- =============================================================================
-- Adaptation à la Guinée (Conakry) :
--  - heure de Conakry (UTC+0, sans heure d'été) pour les créneaux et les prises ;
--  - langue préférée du patient (interface et SMS) ;
--  - rappels de prise par SMS (envoyés par l'Edge Function « rappels-sms »).
-- =============================================================================

-- Fuseau horaire de l'hôpital : un seul endroit à modifier pour un autre pays.
create function public.app_timezone()
returns text
language sql immutable
as $$
  select 'Africa/Conakry'
$$;
grant execute on function public.app_timezone() to authenticated;

-- -----------------------------------------------------------------------------
-- Créneaux et prises : heure locale de l'hôpital au lieu de l'heure de Paris
-- -----------------------------------------------------------------------------

create or replace function public.generate_slots(
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
    (d::date + t::time) at time zone public.app_timezone(),
    (d::date + t::time + make_interval(mins => p_duree_minutes)) at time zone public.app_timezone()
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

create or replace function public.generate_intakes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.medication_intakes (prescription_item_id, patient_id, prevu_a)
  select
    new.id,
    p.patient_id,
    (d::date + h) at time zone public.app_timezone()
  from public.prescriptions p
  cross join generate_series(new.date_debut, new.date_fin, interval '1 day') d
  cross join unnest(new.horaires) h
  where p.id = new.prescription_id
  on conflict do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Préférences du patient
-- -----------------------------------------------------------------------------

-- fr : français, en : anglais, sus : soussou, ff : pular, emk : malinké.
alter table public.patients
  add column langue text not null default 'fr' check (langue in ('fr', 'en', 'sus', 'ff', 'emk')),
  add column rappels_sms boolean not null default false;

grant update (langue, rappels_sms) on public.patients to authenticated;

-- Numéro au format international guinéen (+224 6XX XX XX XX), seul format accepté pour les SMS.
alter table public.profiles
  add constraint profiles_telephone_format check (telephone is null or telephone ~ '^\+2246[0-9]{8}$');

-- -----------------------------------------------------------------------------
-- Rappels par SMS
-- -----------------------------------------------------------------------------

alter table public.medication_intakes add column sms_envoye_at timestamptz;

/**
 * Réserve les rappels SMS à envoyer maintenant : prises prévues dans les
 * 30 dernières minutes, pas encore prises ni rappelées, pour les patients qui
 * ont activé l'option et donné un numéro. Les prises sont marquées comme
 * rappelées dans la même requête : deux exécutions simultanées n'envoient pas
 * deux fois le même SMS. Un SMS par patient et par horaire.
 * Réservé à l'Edge Function (service_role).
 */
create function public.claim_sms_reminders()
returns table (intake_ids uuid[], telephone text, langue text, prevu_a timestamptz, nombre int)
language sql security definer set search_path = ''
as $$
  with dues as (
    select mi.id
    from public.medication_intakes mi
    join public.patients pa on pa.id = mi.patient_id
    join public.profiles pr on pr.id = mi.patient_id
    where mi.statut = 'a_prendre'
      and mi.sms_envoye_at is null
      and mi.prevu_a between now() - interval '30 minutes' and now()
      and pa.rappels_sms
      and pr.telephone is not null
    for update of mi skip locked
  ), claimed as (
    update public.medication_intakes mi
    set sms_envoye_at = now()
    from dues
    where mi.id = dues.id
    returning mi.id, mi.patient_id, mi.prevu_a
  )
  select array_agg(c.id), pr.telephone, pa.langue, c.prevu_a, count(*)::int
  from claimed c
  join public.patients pa on pa.id = c.patient_id
  join public.profiles pr on pr.id = c.patient_id
  group by c.patient_id, pr.telephone, pa.langue, c.prevu_a
$$;

-- En cas d'échec d'envoi : les prises redeviennent « à rappeler ».
create function public.release_sms_reminders(p_intake_ids uuid[])
returns void
language sql security definer set search_path = ''
as $$
  update public.medication_intakes set sms_envoye_at = null where id = any (p_intake_ids)
$$;

revoke execute on function public.claim_sms_reminders(), public.release_sms_reminders(uuid[])
  from public, anon, authenticated;
grant execute on function public.claim_sms_reminders(), public.release_sms_reminders(uuid[])
  to service_role;
