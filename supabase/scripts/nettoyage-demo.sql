-- À exécuter une seule fois dans le SQL Editor de Supabase (projet hilal-sante), avant les tests publics.
-- Suppression des comptes et de l'établissement de démonstration ; compte administrateur réel.
begin;

create temp table demo_users on commit drop as
  select id from auth.users where email like '%@demo.fr';
create temp table demo_hospitals on commit drop as
  select id from public.hospitals where nom = 'Établissement de démonstration';
create temp table admin_user on commit drop as
  select id from auth.users where email = 'hilalsanoh@gmail.com';

-- Rendez-vous liés à la démo ou au futur administrateur (il ne sera plus patient) : créneaux libérés.
create temp table appts on commit drop as
  select id, slot_id from public.appointments
  where hospital_id in (select id from demo_hospitals)
     or patient_id in (select id from demo_users union select id from admin_user)
     or practitioner_id in (select id from demo_users);
update public.slots set statut = 'libre' where id in (select slot_id from appts);

-- Écrits médicaux signés par des comptes de démo, ou liés aux rendez-vous supprimés.
delete from public.prescriptions
where practitioner_id in (select id from demo_users)
   or consultation_id in (select id from public.consultations where practitioner_id in (select id from demo_users) or appointment_id in (select id from appts));
update public.documents set consultation_id = null
where consultation_id in (select id from public.consultations where practitioner_id in (select id from demo_users) or appointment_id in (select id from appts));
delete from public.consultations where practitioner_id in (select id from demo_users) or appointment_id in (select id from appts);
delete from public.appointments where id in (select id from appts);
delete from public.allergies where created_by in (select id from demo_users);
delete from public.medical_history where created_by in (select id from demo_users);
delete from public.vaccinations where created_by in (select id from demo_users);
delete from public.documents where created_by in (select id from demo_users);
delete from public.traitements_habituels where created_by in (select id from demo_users);
update public.medical_profiles set updated_by = null where updated_by in (select id from demo_users);

-- Établissement de démonstration (services, tarifs, créneaux, affiliations suivent).
delete from public.slots where hospital_id in (select id from demo_hospitals);
delete from public.hospitals where id in (select id from demo_hospitals);

-- Comptes de démo (profil, dossier, messages… suivent).
delete from auth.users where id in (select id from demo_users);

-- Le compte hilalsanoh@gmail.com devient administrateur de la plateforme.
delete from public.patients where id in (select id from admin_user);
update public.profiles set role = 'admin' where id in (select id from admin_user);
insert into public.audit_log (action, table_name, record_id)
select 'UPDATE_ROLE:admin', 'profiles', id::text from admin_user;

select
  (select count(*) from auth.users where email like '%@demo.fr') as comptes_demo_restants,
  (select string_agg(email || ' : ' || p.role, ', ' order by email) from auth.users u join public.profiles p on p.id = u.id) as comptes,
  (select string_agg(nom || ' (' || statut || ')', ', ') from public.hospitals) as etablissements;
