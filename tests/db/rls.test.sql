-- =============================================================================
-- Tests des règles d'accès (RLS) et des fonctions métier.
-- Tout s'exécute dans une transaction annulée à la fin : la base n'est pas modifiée.
-- Lancement : scripts/test-db.sh (ou psql "$DATABASE_URL" -f tests/db/rls.test.sql)
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
begin;

-- Fixtures (en tant que superutilisateur) ----------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-0000-4000-8000-000000000001', 't-admin@test.fr',  '{"prenom":"Ada"}'),
  ('11111111-0000-4000-8000-000000000002', 't-secr@test.fr',   '{"prenom":"Sam"}'),
  ('11111111-0000-4000-8000-000000000003', 't-med1@test.fr',   '{"prenom":"Med1"}'),
  ('11111111-0000-4000-8000-000000000004', 't-med2@test.fr',   '{"prenom":"Med2"}'),
  ('11111111-0000-4000-8000-000000000005', 't-pat1@test.fr',   '{"prenom":"Pat1"}'),
  ('11111111-0000-4000-8000-000000000006', 't-pat2@test.fr',   '{"prenom":"Pat2", "role":"admin"}');

update public.profiles set role = 'admin'      where id = '11111111-0000-4000-8000-000000000001';
update public.profiles set role = 'secretaire' where id = '11111111-0000-4000-8000-000000000002';
update public.profiles set role = 'medecin'    where id in ('11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000004');
delete from public.patients where id::text like '11111111-0000-4000-8000-00000000000_' and id::text < '11111111-0000-4000-8000-000000000005';

insert into public.services (id, nom) values ('22222222-0000-4000-8000-000000000001', 'Service test');
insert into public.practitioners (id, service_id, specialite) values
  ('11111111-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', 'Test'),
  ('11111111-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000001', 'Test');

insert into public.slots (id, practitioner_id, debut, fin) values
  ('33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000003', now() + interval '2 days', now() + interval '2 days 30 minutes'),
  ('33333333-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes');

-- Petite fonction d'aide : vérifie qu'une instruction échoue.
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

\echo '1. Inscription : le rôle envoyé par le client est ignoré'
do $$ begin
  assert (select role from public.profiles where id = '11111111-0000-4000-8000-000000000006') = 'patient',
    'un client a pu se donner le rôle admin';
end $$;

-- =============================================================================
\echo '2. Patient 1 réserve un rendez-vous'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000005"}', true);

do $$
declare v public.appointments;
begin
  v := public.book_appointment('33333333-0000-4000-8000-000000000001', 'Douleur thoracique');
  assert v.statut = 'confirme', 'rendez-vous non confirmé';
  assert (select statut from public.slots where id = '33333333-0000-4000-8000-000000000001') = 'reserve',
    'créneau non réservé';
  perform pg_temp.doit_echouer($q$select public.book_appointment('33333333-0000-4000-8000-000000000001')$q$,
    'double réservation du même créneau');
  perform pg_temp.doit_echouer($q$select public.book_appointment('33333333-0000-4000-8000-000000000002')$q$,
    'réservation d''un créneau passé');
  perform pg_temp.doit_echouer($q$select public.book_appointment('33333333-0000-4000-8000-000000000001', null, '11111111-0000-4000-8000-000000000006')$q$,
    'un patient réserve pour un autre patient');
end $$;

\echo '3. Un patient ne peut pas se promouvoir ni écrire directement'
do $$ begin
  perform pg_temp.doit_echouer($q$update public.profiles set role = 'admin' where id = auth.uid()$q$,
    'un patient a changé son propre rôle');
  perform pg_temp.doit_echouer($q$select public.set_user_role(auth.uid(), 'admin')$q$,
    'set_user_role appelé par un patient');
  perform pg_temp.doit_echouer($q$insert into public.allergies (patient_id, substance, created_by) values (auth.uid(), 'X', auth.uid())$q$,
    'un patient a écrit dans son dossier médical');
  perform pg_temp.doit_echouer($q$insert into public.audit_log (action, table_name) values ('FAKE', 'x')$q$,
    'un patient a écrit dans le journal d''audit');
  update public.profiles set telephone = '+224622123456' where id = auth.uid();
  assert (select telephone from public.profiles where id = auth.uid()) = '+224622123456',
    'le patient ne peut pas modifier son téléphone';
  perform pg_temp.doit_echouer($q$update public.profiles set telephone = '0600000000' where id = auth.uid()$q$,
    'numéro hors format guinéen accepté');
end $$;

-- =============================================================================
\echo '4. Le médecin 1 (lié par le rendez-vous) écrit dans le dossier et prescrit'
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
  assert (select count(*) from public.patients) = 1, 'le médecin voit des patients qu''il ne suit pas';
  assert (public.get_patient_record('11111111-0000-4000-8000-000000000005') -> 'allergies' -> 0 ->> 'substance') = 'Pénicilline',
    'dossier incomplet';
  perform pg_temp.doit_echouer($q$select public.get_patient_record('11111111-0000-4000-8000-000000000006')$q$,
    'lecture du dossier d''un patient non suivi');
  perform pg_temp.doit_echouer($q$insert into public.allergies (patient_id, substance, created_by) values ('11111111-0000-4000-8000-000000000006', 'X', auth.uid())$q$,
    'écriture dans le dossier d''un patient non suivi');
end $$;

\echo '5. Le médecin 2 (non lié) ne voit rien du patient 1'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000004"}', true);
do $$ begin
  assert (select count(*) from public.allergies) = 0, 'allergies visibles par un médecin non lié';
  assert (select count(*) from public.prescriptions) = 0, 'ordonnances visibles par un médecin non lié';
  assert (select count(*) from public.medication_intakes) = 0, 'prises visibles par un médecin non lié';
  assert (select count(*) from public.appointments) = 0, 'rendez-vous visibles par un médecin non lié';
  perform pg_temp.doit_echouer($q$select public.set_appointment_status((select id from public.appointments limit 1), 'honore')$q$,
    'statut modifié par un autre médecin');
end $$;

\echo '6. Le secrétariat voit les rendez-vous mais pas le contenu médical'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000002"}', true);
do $$ begin
  assert (select count(*) from public.appointments) = 1, 'le secrétariat ne voit pas les rendez-vous';
  assert (select count(*) from public.patients) = 2, 'le secrétariat ne voit pas l''identité des patients';
  assert (select count(*) from public.allergies) = 0, 'le secrétariat voit les allergies';
  assert (select count(*) from public.prescriptions) = 0, 'le secrétariat voit les ordonnances';
  perform pg_temp.doit_echouer($q$select public.get_patient_record('11111111-0000-4000-8000-000000000005')$q$,
    'le secrétariat lit un dossier médical');
  assert public.generate_slots('11111111-0000-4000-8000-000000000004', current_date + 7, current_date + 13,
    '09:00', '10:00', 20, array[1,2,3,4,5]) = 15, '5 jours ouvrés x 3 créneaux de 20 min attendus';
end $$;

\echo '7. L''admin gère les rôles mais ne lit pas le contenu médical'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000001"}', true);
do $$ begin
  assert (select count(*) from public.allergies) = 0, 'l''admin voit les allergies';
  perform public.set_user_role('11111111-0000-4000-8000-000000000006', 'secretaire');
  perform public.set_user_role('11111111-0000-4000-8000-000000000006', 'patient');
  perform pg_temp.doit_echouer($q$select public.set_user_role(auth.uid(), 'patient')$q$,
    'un admin a modifié son propre rôle');
  assert (select count(*) from public.audit_log where action like 'UPDATE_ROLE%') = 2, 'changements de rôle non tracés';
end $$;

-- =============================================================================
\echo '8. Le patient 1 voit son dossier, marque une prise, exporte ses données'
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
  assert jsonb_array_length(v_export -> 'prises') = 6, 'export : prises manquantes';
end $$;

\echo '9. Le patient 2 ne voit rien du patient 1'
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

\echo '10. Annulation par le patient 1 : le créneau redevient libre'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000005"}', true);
do $$ begin
  perform public.cancel_appointment((select id from public.appointments limit 1));
  assert (select statut from public.slots where id = '33333333-0000-4000-8000-000000000001') = 'libre', 'créneau non libéré';
end $$;

\echo '11. Arrêt de l''ordonnance : les prises futures sont supprimées'
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000003"}', true);
do $$ begin
  update public.prescriptions set statut = 'terminee' where id = '44444444-0000-4000-8000-000000000001';
  assert not exists (select 1 from public.medication_intakes where statut = 'a_prendre' and prevu_a > now()),
    'des prises futures subsistent';
end $$;

\echo '12. Stockage : un fichier n''est lisible que par le patient et ses médecins'
reset role;
insert into storage.objects (bucket_id, name) values
  ('documents', '11111111-0000-4000-8000-000000000005/analyse.pdf'),
  ('documents', 'pas-un-uuid/fichier.pdf');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000003"}', true);
do $$ begin
  assert (select count(*) from storage.objects) = 1, 'le médecin lié ne voit pas le fichier';
end $$;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000004"}', true);
do $$ begin
  assert (select count(*) from storage.objects) = 0, 'un médecin non lié voit le fichier';
  perform pg_temp.doit_echouer($q$insert into storage.objects (bucket_id, name) values ('documents', '11111111-0000-4000-8000-000000000005/x.pdf')$q$,
    'dépôt de fichier par un médecin non lié');
end $$;

\echo '13. Un visiteur non connecté n''a accès à rien'
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.doit_echouer('select 1 from public.slots', 'lecture anonyme des créneaux');
  perform pg_temp.doit_echouer('select public.export_my_data()', 'appel anonyme d''une fonction');
end $$;

\echo '14. Rappels SMS : préférences du patient et envoi réservé au serveur'
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
-- Trois prises : une due maintenant, une trop ancienne, une déjà prise.
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
