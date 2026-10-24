-- =============================================================================
-- Tests des règles d'accès (RLS) et des fonctions métier de la plateforme.
-- Tout s'exécute dans une transaction annulée à la fin : la base n'est pas modifiée.
-- Lancement : scripts/test-db.sh (ou psql "$DATABASE_URL" -f tests/db/rls.test.sql)
--
-- Comptes : 01 admin plateforme · 02 gestionnaire H1 (validé) · 07 gestionnaire H2 (en attente)
--           03 médecin (compte existant) · 04 médecin invité avant d'avoir un compte
--           05 et 06 patients
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
begin;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon, service_role;

-- Vérifie qu'une instruction échoue.
create function pg_temp.doit_echouer(p_sql text, p_message text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ÉCHEC : % (l''instruction aurait dû être refusée)', p_message;
exception when others then
  if sqlerrm like 'ÉCHEC%' then raise; end if;
end;
$$;
grant execute on function pg_temp.doit_echouer(text, text) to authenticated, anon;

create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;
grant execute on function pg_temp.id(text) to authenticated, anon, service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-0000-4000-8000-000000000001', 't-admin@test.fr', '{"prenom":"Ada"}'),
  ('11111111-0000-4000-8000-000000000002', 't-gest1@test.fr', '{"prenom":"Gest1"}'),
  ('11111111-0000-4000-8000-000000000003', 't-med1@test.fr',  '{"prenom":"Med1"}'),
  ('11111111-0000-4000-8000-000000000005', 't-pat1@test.fr',  '{"prenom":"Pat1"}'),
  ('11111111-0000-4000-8000-000000000006', 't-pat2@test.fr',  '{"prenom":"Pat2", "role":"admin"}'),
  ('11111111-0000-4000-8000-000000000007', 't-gest2@test.fr', '{"prenom":"Gest2"}');
update public.profiles set role = 'admin' where id = '11111111-0000-4000-8000-000000000001';
delete from public.patients where id = '11111111-0000-4000-8000-000000000001';

\echo '1. Inscription : le rôle envoyé par le client est ignoré'
do $$ begin
  assert (select role from public.profiles where id = '11111111-0000-4000-8000-000000000006') = 'patient',
    'un client a pu se donner le rôle admin';
end $$;

\echo '1b. Inscription d''un établissement en une étape : gestionnaire d''un établissement en attente'
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-0000-4000-8000-000000000009', 't-gest3@test.fr',
   '{"prenom":"Gest3","type_compte":"etablissement","role":"admin","etablissement":{"nom":"Centre Test","type":"centre_sante","ville":"Labé","numero_agrement":"AGR-TEST-3"}}');
do $$ begin
  assert (select role from public.profiles where id = '11111111-0000-4000-8000-000000000009') = 'gestionnaire',
    'le compte d''établissement n''est pas gestionnaire';
  assert (select h.statut from public.hospitals h join public.hospital_members m on m.hospital_id = h.id
          where m.user_id = '11111111-0000-4000-8000-000000000009') = 'en_attente', 'établissement non créé en attente';
  assert not exists (select 1 from public.patients where id = '11111111-0000-4000-8000-000000000009'),
    'le compte d''établissement a un dossier patient';
end $$;

-- =============================================================================
\echo '2. Un établissement s''inscrit : en attente, il ne peut ni publier ni enregistrer de médecin'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$
declare h public.hospitals;
begin
  h := public.register_hospital('Hôpital Test', 'hopital_public', 'Conakry', 'AGR-TEST-1', 'Dixinn');
  insert into ids values ('h1', h.id);
  assert h.statut = 'en_attente', 'établissement validé sans contrôle';
  assert public.current_app_role() = 'gestionnaire', 'le compte n''est pas devenu gestionnaire';
  assert not exists (select 1 from public.patients where id = auth.uid()), 'le gestionnaire est resté patient';
  perform pg_temp.doit_echouer($q$update public.hospitals set statut = 'valide' where id = pg_temp.id('h1')$q$,
    'un établissement s''est validé lui-même');
  perform pg_temp.doit_echouer($q$select public.review_hospital(pg_temp.id('h1'), 'valide')$q$,
    'un gestionnaire a utilisé review_hospital');

  insert into public.services (id, hospital_id, nom) values ('22222222-0000-4000-8000-000000000001', h.id, 'Médecine générale');
  insert into public.tarifs (hospital_id, service_id, libelle, prix_gnf)
  values (h.id, '22222222-0000-4000-8000-000000000001', 'Consultation', 50000);
  perform pg_temp.doit_echouer($q$select public.add_doctor(pg_temp.id('h1'), 't-med1@test.fr', 'Med', 'Un', 'Généraliste', 'ONMG-1', '22222222-0000-4000-8000-000000000001')$q$,
    'un établissement non validé a enregistré un médecin');
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000007"}', true);
do $$
declare h public.hospitals;
begin
  h := public.register_hospital('Clinique Test', 'clinique_privee', 'Kindia', 'AGR-TEST-2');
  insert into ids values ('h2', h.id);
  insert into public.services (id, hospital_id, nom) values ('22222222-0000-4000-8000-000000000002', h.id, 'Pédiatrie');
  assert (select count(*) from public.hospitals) = 1, 'un gestionnaire voit un établissement non validé qui n''est pas le sien';
end $$;

\echo '3. Un patient ne voit aucun établissement non validé'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000005"}', true);
do $$ begin
  assert (select count(*) from public.hospitals) = 0, 'établissement en attente visible par un patient';
  assert (select count(*) from public.services) = 0, 'service d''un établissement en attente visible';
  assert (select count(*) from public.tarifs) = 0, 'tarif d''un établissement en attente visible';
end $$;

\echo '4. L''admin de la plateforme valide l''établissement 1'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000001"}', true);
do $$ begin
  assert (select count(*) from public.hospitals where statut = 'en_attente') = 3, 'l''admin ne voit pas les demandes';
  perform public.review_hospital(pg_temp.id('h1'), 'valide');
  assert (select statut from public.hospitals where id = pg_temp.id('h1')) = 'valide', 'validation non enregistrée';
end $$;

-- =============================================================================
\echo '5. L''établissement validé enregistre ses médecins et s''en porte garant'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$ begin
  assert public.add_doctor(pg_temp.id('h1'), 'T-Med1@test.fr', 'Med', 'Un', 'Généraliste', 'onmg-1',
    '22222222-0000-4000-8000-000000000001') = 'affilie', 'compte existant non affilié';
  assert public.add_doctor(pg_temp.id('h1'), 't-med2@test.fr', 'Med', 'Deux', 'Pédiatre', 'ONMG-2',
    '22222222-0000-4000-8000-000000000001') = 'invite', 'invitation non créée';
  perform pg_temp.doit_echouer($q$select public.add_doctor(pg_temp.id('h1'), 'autre@test.fr', 'X', 'Y', 'Z', 'ONMG-1', '22222222-0000-4000-8000-000000000001')$q$,
    'numéro de l''Ordre réutilisé pour un autre médecin');
  perform pg_temp.doit_echouer($q$select public.add_doctor(pg_temp.id('h1'), 'x@test.fr', 'X', 'Y', 'Z', '', '22222222-0000-4000-8000-000000000001')$q$,
    'médecin sans numéro de l''Ordre');
  perform pg_temp.doit_echouer($q$select public.add_doctor(pg_temp.id('h1'), 'x@test.fr', 'X', 'Y', 'Z', 'ONMG-9', '22222222-0000-4000-8000-000000000002')$q$,
    'médecin rattaché au service d''un autre établissement');
  assert (select numero_ordre from public.practitioners where id = '11111111-0000-4000-8000-000000000003') = 'ONMG-1',
    'numéro de l''Ordre non enregistré';
  assert (select garant_hospital_id from public.practitioners where id = '11111111-0000-4000-8000-000000000003') = pg_temp.id('h1'),
    'établissement garant non enregistré';
end $$;

reset role;
-- Le médecin invité crée son compte : il devient médecin, rattaché à l'établissement.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-0000-4000-8000-000000000004', 't-med2@test.fr', '{"prenom":"Usurpe","nom":"Nom"}');
do $$ begin
  assert (select role from public.profiles where id = '11111111-0000-4000-8000-000000000004') = 'medecin', 'invité non converti en médecin';
  assert (select prenom from public.profiles where id = '11111111-0000-4000-8000-000000000004') = 'Med', 'identité de l''invitation non reprise';
  assert exists (select 1 from public.hospital_doctors where practitioner_id = '11111111-0000-4000-8000-000000000004'), 'invité non affilié';
  assert not exists (select 1 from public.patients where id = '11111111-0000-4000-8000-000000000004'), 'invité créé comme patient';
  assert not exists (select 1 from public.doctor_invitations), 'invitation non supprimée';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000007"}', true);
do $$ begin
  perform pg_temp.doit_echouer($q$insert into public.services (hospital_id, nom) values (pg_temp.id('h1'), 'Intrus')$q$,
    'un établissement a créé un service chez un autre');
  update public.tarifs set prix_gnf = 1 where hospital_id = pg_temp.id('h1');
  perform pg_temp.doit_echouer($q$select public.generate_slots(pg_temp.id('h2'), '11111111-0000-4000-8000-000000000003', current_date + 1, current_date + 7, '08:00', '09:00', 30)$q$,
    'créneaux générés par un établissement non validé');
end $$;

\echo '6. Créneaux : seulement pour les médecins actifs de l''établissement'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$ begin
  assert (select prix_gnf from public.tarifs where hospital_id = pg_temp.id('h1')) = 50000, 'un autre établissement a modifié les tarifs';
  assert public.generate_slots(pg_temp.id('h1'), '11111111-0000-4000-8000-000000000003',
    current_date + 7, current_date + 13, '09:00', '10:00', 20, array[1,2,3,4,5]) = 15, '5 jours ouvrés x 3 créneaux de 20 min attendus';
  perform pg_temp.doit_echouer($q$select public.generate_slots(pg_temp.id('h1'), '11111111-0000-4000-8000-000000000005', current_date + 1, current_date + 7, '08:00', '09:00', 30)$q$,
    'créneaux pour quelqu''un qui n''est pas médecin de l''établissement');
  insert into public.slots (id, hospital_id, practitioner_id, debut, fin) values
    ('33333333-0000-4000-8000-000000000001', pg_temp.id('h1'), '11111111-0000-4000-8000-000000000003', now() + interval '2 days', now() + interval '2 days 30 minutes'),
    ('33333333-0000-4000-8000-000000000002', pg_temp.id('h1'), '11111111-0000-4000-8000-000000000003', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes');
end $$;

-- =============================================================================
\echo '7. Le patient 1 réserve dans l''établissement choisi'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000005"}', true);
do $$
declare v public.appointments;
begin
  assert (select count(*) from public.hospitals) = 1, 'le patient ne voit pas l''établissement validé';
  assert (select count(*) from public.tarifs) = 1, 'tarifs non visibles';
  assert (select count(*) from public.hospital_doctors) = 2, 'médecins de l''établissement non visibles';
  v := public.book_appointment('33333333-0000-4000-8000-000000000001', 'Douleur thoracique');
  assert v.statut = 'confirme' and v.hospital_id = pg_temp.id('h1'), 'rendez-vous mal enregistré';
  perform pg_temp.doit_echouer($q$select public.book_appointment('33333333-0000-4000-8000-000000000001')$q$,
    'double réservation du même créneau');
  perform pg_temp.doit_echouer($q$select public.book_appointment('33333333-0000-4000-8000-000000000002')$q$,
    'réservation d''un créneau passé');
  perform pg_temp.doit_echouer($q$select public.book_appointment('33333333-0000-4000-8000-000000000001', null, '11111111-0000-4000-8000-000000000006')$q$,
    'un patient réserve pour un autre patient');
  perform pg_temp.doit_echouer($q$select public.register_hospital('X', 'cabinet', 'Labé', 'AGR-X')$q$,
    'un compte patient avec rendez-vous est devenu gestionnaire');
end $$;

reset role;
insert into public.slots (id, hospital_id, practitioner_id, debut, fin) values
  ('33333333-0000-4000-8000-000000000003', (select v from ids where k = 'h2'), '11111111-0000-4000-8000-000000000004', now() + interval '3 days', now() + interval '3 days 30 minutes');
set local role authenticated;
do $$ begin
  perform pg_temp.doit_echouer($q$select public.book_appointment('33333333-0000-4000-8000-000000000003')$q$,
    'réservation dans un établissement non validé');
end $$;

\echo '8. Un patient ne peut pas se promouvoir ni écrire directement'
do $$ begin
  perform pg_temp.doit_echouer($q$update public.profiles set role = 'admin' where id = auth.uid()$q$,
    'un patient a changé son propre rôle');
  perform pg_temp.doit_echouer($q$select public.set_user_role(auth.uid(), 'admin')$q$,
    'set_user_role appelé par un patient');
  perform pg_temp.doit_echouer($q$insert into public.allergies (patient_id, substance, created_by) values (auth.uid(), 'X', auth.uid())$q$,
    'un patient a écrit dans son dossier médical');
  perform pg_temp.doit_echouer($q$insert into public.audit_log (action, table_name) values ('FAKE', 'x')$q$,
    'un patient a écrit dans le journal d''audit');
  perform pg_temp.doit_echouer($q$insert into public.tarifs (hospital_id, libelle, prix_gnf) values (pg_temp.id('h1'), 'X', 1)$q$,
    'un patient a créé un tarif');
  update public.profiles set telephone = '+224622123456' where id = auth.uid();
  assert (select telephone from public.profiles where id = auth.uid()) = '+224622123456',
    'le patient ne peut pas modifier son téléphone';
  perform pg_temp.doit_echouer($q$update public.profiles set telephone = '0600000000' where id = auth.uid()$q$,
    'numéro hors format guinéen accepté');
end $$;

-- =============================================================================
\echo '9. L''établissement voit ses rendez-vous et ses patients, pas leur contenu médical'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$ begin
  assert (select count(*) from public.appointments) = 1, 'l''établissement ne voit pas ses rendez-vous';
  assert (select count(*) from public.patients) = 1, 'l''établissement ne voit pas l''identité de son patient';
  assert (select count(*) from public.profiles where id = '11111111-0000-4000-8000-000000000006') = 0,
    'l''établissement voit un patient qui ne l''a jamais consulté';
  perform pg_temp.doit_echouer($q$select public.get_patient_record('11111111-0000-4000-8000-000000000005')$q$,
    'un établissement lit un dossier médical');
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000007"}', true);
do $$ begin
  assert (select count(*) from public.appointments) = 0, 'un autre établissement voit les rendez-vous';
  assert (select count(*) from public.patients) = 0, 'un autre établissement voit les patients';
  perform pg_temp.doit_echouer($q$select public.cancel_appointment((select id from public.appointments limit 1))$q$,
    'un autre établissement annule un rendez-vous');
end $$;

\echo '10. Le médecin du rendez-vous écrit dans le dossier et prescrit'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000003"}', true);
do $$ begin
  insert into public.allergies (patient_id, substance, created_by)
  values ('11111111-0000-4000-8000-000000000005', 'Pénicilline', auth.uid());

  insert into public.prescriptions (id, patient_id, practitioner_id)
  values ('44444444-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000005', auth.uid());
  insert into public.prescription_items (prescription_id, medicament, dosage, horaires, date_debut, date_fin)
  values ('44444444-0000-4000-8000-000000000001', 'Médicament test', '1 cp',
          array['08:00', '20:00']::time[], current_date, current_date + 2);

  assert (select count(*) from public.medication_intakes where patient_id = '11111111-0000-4000-8000-000000000005') = 6,
    '3 jours x 2 horaires devraient donner 6 prises';
  assert (public.get_patient_record('11111111-0000-4000-8000-000000000005') -> 'allergies' -> 0 ->> 'substance') = 'Pénicilline',
    'dossier incomplet';
  perform pg_temp.doit_echouer($q$select public.get_patient_record('11111111-0000-4000-8000-000000000006')$q$,
    'lecture du dossier d''un patient non suivi');
end $$;

\echo '11. Le médecin non concerné ne voit rien'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000004"}', true);
do $$ begin
  assert (select count(*) from public.allergies) = 0, 'allergies visibles par un médecin non lié';
  assert (select count(*) from public.appointments) = 0, 'rendez-vous visibles par un médecin non lié';
  perform pg_temp.doit_echouer($q$select public.set_appointment_status((select id from public.appointments limit 1), 'honore')$q$,
    'statut modifié par un autre médecin');
end $$;

\echo '12. L''admin de la plateforme gère les comptes, sans accès médical ni aux rendez-vous'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000001"}', true);
do $$ begin
  assert (select count(*) from public.allergies) = 0, 'l''admin voit les allergies';
  assert (select count(*) from public.appointments) = 0, 'l''admin voit les rendez-vous';
  assert (select count(*) from public.patients) = 0, 'l''admin voit les patients';
  perform public.review_hospital(pg_temp.id('h2'), 'refuse', 'Agrément illisible');
  assert (select motif_refus from public.hospitals where id = pg_temp.id('h2')) = 'Agrément illisible', 'motif de refus non enregistré';
  perform pg_temp.doit_echouer($q$select public.set_user_role(auth.uid(), 'patient')$q$,
    'un admin a modifié son propre rôle');
end $$;

-- =============================================================================
\echo '13. Médecin traitant et messagerie'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000005"}', true);
do $$ begin
  perform public.set_medecin_traitant('11111111-0000-4000-8000-000000000003');
  assert (select medecin_traitant_id from public.patients where id = auth.uid()) = '11111111-0000-4000-8000-000000000003',
    'médecin traitant non enregistré';
  perform pg_temp.doit_echouer($q$select public.set_medecin_traitant('11111111-0000-4000-8000-000000000006')$q$,
    'un patient choisi comme médecin traitant');
  perform pg_temp.doit_echouer($q$update public.patients set medecin_traitant_id = '11111111-0000-4000-8000-000000000004' where id = auth.uid()$q$,
    'médecin traitant modifié sans passer par la fonction');

  insert into public.messages (patient_id, practitioner_id, auteur_id, contenu)
  values (auth.uid(), '11111111-0000-4000-8000-000000000003', auth.uid(), 'Bonjour docteur');
  perform pg_temp.doit_echouer($q$insert into public.messages (patient_id, practitioner_id, auteur_id, contenu) values (auth.uid(), '11111111-0000-4000-8000-000000000004', auth.uid(), 'Bonjour')$q$,
    'message à un médecin qui ne suit pas le patient');
  perform pg_temp.doit_echouer($q$insert into public.messages (patient_id, practitioner_id, auteur_id, contenu) values (auth.uid(), '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 'Faux')$q$,
    'message envoyé au nom du médecin');
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000003"}', true);
do $$ begin
  assert (select count(*) from public.messages) = 1, 'le médecin ne voit pas le message';
  insert into public.messages (patient_id, practitioner_id, auteur_id, contenu)
  values ('11111111-0000-4000-8000-000000000005', auth.uid(), auth.uid(), 'Bonjour, comment allez-vous ?');
  perform public.mark_messages_read('11111111-0000-4000-8000-000000000005', auth.uid());
  assert (select lu_at from public.messages where auteur_id = '11111111-0000-4000-8000-000000000005') is not null,
    'message du patient non marqué comme lu';
  perform pg_temp.doit_echouer($q$update public.messages set contenu = 'modifié'$q$, 'message modifié après envoi');
end $$;

select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000004"}', true);
do $$ begin
  assert (select count(*) from public.messages) = 0, 'un autre médecin lit les messages';
end $$;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000006"}', true);
do $$ begin
  assert (select count(*) from public.messages) = 0, 'un autre patient lit les messages';
end $$;

-- =============================================================================
\echo '14. Le patient 1 marque une prise, voit les accès à son dossier, exporte ses données'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000005"}', true);
do $$
declare v_export jsonb;
begin
  assert (select count(*) from public.allergies) = 1, 'le patient ne voit pas ses allergies';
  perform public.record_intake(
    (select id from public.medication_intakes where prevu_a::date = current_date order by prevu_a limit 1), 'pris');
  assert (select count(*) from public.medication_intakes where statut = 'pris') = 1, 'prise non enregistrée';
  perform pg_temp.doit_echouer($q$select public.record_intake((select id from public.medication_intakes order by prevu_a desc limit 1), 'pris')$q$,
    'prise marquée plus de 12 h à l''avance');
  assert (select count(*) from public.audit_log where action = 'READ') = 1,
    'le patient ne voit pas que le médecin a consulté son dossier';

  v_export := public.export_my_data();
  assert jsonb_array_length(v_export -> 'rendez_vous') = 1, 'export : rendez-vous manquant';
  assert v_export -> 'rendez_vous' -> 0 ->> 'etablissement' = 'Hôpital Test', 'export : établissement manquant';
  assert jsonb_array_length(v_export -> 'messages') = 2, 'export : messages manquants';
end $$;

\echo '15. Le patient 2 ne voit rien du patient 1'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000006"}', true);
do $$ begin
  assert (select count(*) from public.allergies) = 0, 'allergies d''un autre patient visibles';
  assert (select count(*) from public.appointments) = 0, 'rendez-vous d''un autre patient visibles';
  assert (select count(*) from public.patients) = 1, 'identité d''un autre patient visible';
  assert (select count(*) from public.audit_log where patient_id is distinct from auth.uid()) = 0,
    'journal d''un autre patient visible';
  perform pg_temp.doit_echouer($q$select public.cancel_appointment((select id from public.appointments limit 1))$q$,
    'annulation du rendez-vous d''un autre patient');
end $$;

\echo '16. Annulation par l''établissement : le créneau redevient libre'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$ begin
  perform public.cancel_appointment((select id from public.appointments limit 1));
  assert (select statut from public.slots where id = '33333333-0000-4000-8000-000000000001') = 'libre', 'créneau non libéré';
end $$;

\echo '17. Arrêt de l''ordonnance : les prises futures sont supprimées'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000003"}', true);
do $$ begin
  update public.prescriptions set statut = 'terminee' where id = '44444444-0000-4000-8000-000000000001';
  assert not exists (select 1 from public.medication_intakes where statut = 'a_prendre' and prevu_a > now()),
    'des prises futures subsistent';
end $$;

\echo '18. Un compte déjà patient ne devient pas médecin par erreur'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$ begin
  perform pg_temp.doit_echouer($q$select public.add_doctor(pg_temp.id('h1'), 't-pat1@test.fr', 'P', 'Un', 'X', 'ONMG-5', '22222222-0000-4000-8000-000000000001')$q$,
    'un compte patient avec un dossier converti en médecin');
end $$;

\echo '19. Stockage : un fichier n''est lisible que par le patient et ses médecins'
reset role;
insert into storage.objects (bucket_id, name) values
  ('documents', '11111111-0000-4000-8000-000000000005/analyse.pdf'),
  ('documents', 'pas-un-uuid/fichier.pdf');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000003"}', true);
do $$ begin
  assert (select count(*) from storage.objects) = 1, 'le médecin lié ne voit pas le fichier';
end $$;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$ begin
  assert (select count(*) from storage.objects) = 0, 'l''établissement voit un document médical';
end $$;

\echo '20. Un visiteur non connecté n''a accès à rien'
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.doit_echouer('select 1 from public.hospitals', 'lecture anonyme des établissements');
  perform pg_temp.doit_echouer('select 1 from public.tarifs', 'lecture anonyme des tarifs');
  perform pg_temp.doit_echouer('select public.export_my_data()', 'appel anonyme d''une fonction');
end $$;

\echo '21. Rappels SMS : préférences du patient et envoi réservé au serveur'
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000005"}', true);
do $$ begin
  update public.patients set rappels_sms = true, langue = 'ff' where id = auth.uid();
  perform pg_temp.doit_echouer($q$update public.patients set langue = 'xx' where id = auth.uid()$q$,
    'langue inconnue acceptée');
  perform pg_temp.doit_echouer($q$update public.medication_intakes set sms_envoye_at = now()$q$,
    'un patient a modifié l''état d''envoi des SMS');
  perform pg_temp.doit_echouer('select * from public.claim_sms_reminders()',
    'un patient a déclenché l''envoi des SMS');
end $$;

reset role;
insert into public.medication_intakes (prescription_item_id, patient_id, prevu_a, statut)
select i.id, '11111111-0000-4000-8000-000000000005', t.prevu_a, t.statut::public.intake_status
from public.prescription_items i
cross join (values
  (date_trunc('minute', now()) - interval '5 minutes', 'a_prendre'),
  (date_trunc('minute', now()) - interval '3 hours', 'a_prendre'),
  (date_trunc('minute', now()) - interval '10 minutes', 'pris')
) as t (prevu_a, statut)
where i.prescription_id = '44444444-0000-4000-8000-000000000001';

set local role service_role;
do $$
declare r record;
begin
  select * into strict r from public.claim_sms_reminders();
  assert r.nombre = 1 and r.telephone = '+224622123456' and r.langue = 'ff', 'rappel SMS incorrect';
  assert not exists (select 1 from public.claim_sms_reminders()), 'le même rappel a été réservé deux fois';
  perform public.release_sms_reminders(r.intake_ids);
  assert (select count(*) from public.claim_sms_reminders()) = 1, 'rappel non remis en file après un échec';
end $$;

rollback;
\echo 'Tous les tests sont passés.'
