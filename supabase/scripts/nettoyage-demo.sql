-- À exécuter une seule fois dans le SQL Editor de Supabase (projet hilal-sante), avant les tests publics.
-- Supprime les comptes (@demo.fr) et l'établissement de démonstration ;
-- hilalsanoh@gmail.com devient administrateur de la plateforme.
-- Un seul bloc : tout est appliqué, ou rien en cas d'erreur.
do $$
declare
  v_demo uuid[];
  v_hospitals uuid[];
  v_admin uuid;
  v_appts uuid[];
  v_consultations uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_demo from auth.users where email like '%@demo.fr';
  select coalesce(array_agg(id), '{}') into v_hospitals from public.hospitals where nom = 'Établissement de démonstration';
  select id into v_admin from auth.users where email = 'hilalsanoh@gmail.com';

  -- Rendez-vous liés à la démo ou au futur administrateur (il ne sera plus patient) : créneaux libérés.
  select coalesce(array_agg(id), '{}') into v_appts from public.appointments
  where hospital_id = any (v_hospitals) or patient_id = any (v_demo) or patient_id = v_admin or practitioner_id = any (v_demo);
  update public.slots set statut = 'libre' where id in (select slot_id from public.appointments where id = any (v_appts));

  -- Écrits médicaux signés par des comptes de démo, ou liés à ces rendez-vous.
  select coalesce(array_agg(id), '{}') into v_consultations from public.consultations
  where practitioner_id = any (v_demo) or appointment_id = any (v_appts);
  delete from public.prescriptions where practitioner_id = any (v_demo) or consultation_id = any (v_consultations);
  update public.documents set consultation_id = null where consultation_id = any (v_consultations);
  delete from public.consultations where id = any (v_consultations);
  delete from public.appointments where id = any (v_appts);
  delete from public.allergies where created_by = any (v_demo);
  delete from public.medical_history where created_by = any (v_demo);
  delete from public.vaccinations where created_by = any (v_demo);
  delete from public.documents where created_by = any (v_demo);
  delete from public.traitements_habituels where created_by = any (v_demo);
  update public.medical_profiles set updated_by = null where updated_by = any (v_demo);

  -- Établissement de démonstration (services, tarifs, créneaux, affiliations suivent).
  delete from public.slots where hospital_id = any (v_hospitals);
  delete from public.hospitals where id = any (v_hospitals);

  -- Comptes de démo (profil, dossier, messages… suivent).
  delete from auth.users where id = any (v_demo);

  -- Compte administrateur.
  if v_admin is not null then
    delete from public.patients where id = v_admin;
    update public.profiles set role = 'admin' where id = v_admin;
    insert into public.audit_log (action, table_name, record_id) values ('UPDATE_ROLE:admin', 'profiles', v_admin::text);
  end if;
end;
$$;

-- Vérification : 0 compte de démo, hilalsanoh@gmail.com administrateur.
select
  (select count(*) from auth.users where email like '%@demo.fr') as comptes_demo_restants,
  (select string_agg(u.email || ' : ' || p.role, ', ' order by u.email) from auth.users u join public.profiles p on p.id = u.id) as comptes,
  (select string_agg(nom || ' (' || statut || ')', ', ') from public.hospitals) as etablissements;
