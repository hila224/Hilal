-- =============================================================================
-- Données de démonstration — 100 % FICTIVES. Ne jamais mettre de vraies données ici.
-- Tous les comptes ont le mot de passe : Demo-Hopital-2026
-- =============================================================================

-- Comptes ------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt('Demo-Hopital-2026', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('prenom', u.prenom, 'nom', u.nom),
  '', '', '', '', now(), now()
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@demo.fr',        'Camille', 'Admin'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'secretariat@demo.fr',  'Sofia',   'Benali'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'dr.martin@demo.fr',    'Paul',    'Martin'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'dr.diallo@demo.fr',    'Aïssatou','Diallo'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'alice@demo.fr',        'Alice',   'Durand'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'karim@demo.fr',        'Karim',   'Haddad')
) as u (id, email, prenom, nom);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like '%@demo.fr';

-- Le trigger a créé un profil "patient" pour chacun : on promeut le personnel.
update public.profiles set role = 'admin'      where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'secretaire' where id = 'a0000000-0000-4000-8000-000000000002';
update public.profiles set role = 'medecin'    where id in ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004');
delete from public.patients where id in (
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004'
);

update public.patients set date_naissance = '1990-04-12', sexe = 'F', consentement_rgpd_at = now()
where id = 'a0000000-0000-4000-8000-000000000005';
update public.patients set date_naissance = '1978-11-03', sexe = 'M', consentement_rgpd_at = now()
where id = 'a0000000-0000-4000-8000-000000000006';

-- Organisation -------------------------------------------------------------------
insert into public.services (id, nom, description) values
  ('b0000000-0000-4000-8000-000000000001', 'Cardiologie', 'Maladies du cœur et des vaisseaux'),
  ('b0000000-0000-4000-8000-000000000002', 'Médecine générale', 'Consultations de premier recours'),
  ('b0000000-0000-4000-8000-000000000003', 'Pédiatrie', 'Enfants et adolescents');

insert into public.practitioners (id, service_id, specialite, rpps) values
  ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Cardiologue', '10000000001'),
  ('a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'Médecin généraliste', '10000000002');

-- Créneaux : 14 prochains jours ouvrés, 9h-12h, 30 minutes (heure de Paris) ----------
insert into public.slots (practitioner_id, debut, fin)
select pr.id,
       (d::date + t::time) at time zone 'Europe/Paris',
       (d::date + t::time + interval '30 minutes') at time zone 'Europe/Paris'
from public.practitioners pr
cross join generate_series(current_date + 1, current_date + 20, interval '1 day') d
cross join generate_series(timestamp '2000-01-01 09:00', timestamp '2000-01-01 11:30', interval '30 minutes') t
where extract(isodow from d) < 6;

-- Une consultation passée (honorée) et un rendez-vous à venir pour Alice ---------------
insert into public.slots (id, practitioner_id, debut, fin, statut) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004',
   ((current_date - 10) + time '10:00') at time zone 'Europe/Paris',
   ((current_date - 10) + time '10:30') at time zone 'Europe/Paris', 'reserve');

insert into public.appointments (slot_id, patient_id, practitioner_id, motif, statut) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000004', 'Fatigue et maux de tête', 'honore');

with prochain as (
  select id, practitioner_id from public.slots
  where practitioner_id = 'a0000000-0000-4000-8000-000000000003' and statut = 'libre'
  order by debut limit 1
), reserve as (
  update public.slots s set statut = 'reserve' from prochain where s.id = prochain.id
  returning s.id, s.practitioner_id
)
insert into public.appointments (slot_id, patient_id, practitioner_id, motif)
select id, 'a0000000-0000-4000-8000-000000000005', practitioner_id, 'Bilan cardiaque de contrôle'
from reserve;

insert into public.care_relationships (patient_id, practitioner_id) values
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003');

-- Dossier médical d'Alice (saisi par le Dr Diallo) ---------------------------------
insert into public.medical_profiles (patient_id, groupe_sanguin, taille_cm, poids_kg, updated_by) values
  ('a0000000-0000-4000-8000-000000000005', 'O+', 168, 61.5, 'a0000000-0000-4000-8000-000000000004');

insert into public.allergies (patient_id, substance, reaction, severite, created_by) values
  ('a0000000-0000-4000-8000-000000000005', 'Pénicilline', 'Urticaire', 'moderee', 'a0000000-0000-4000-8000-000000000004');

insert into public.medical_history (patient_id, type, description, date_evenement, created_by) values
  ('a0000000-0000-4000-8000-000000000005', 'chirurgical', 'Appendicectomie', '2008-06-15', 'a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000005', 'familial', 'Hypertension artérielle (père)', null, 'a0000000-0000-4000-8000-000000000004');

insert into public.vaccinations (patient_id, vaccin, date_administration, lot, created_by) values
  ('a0000000-0000-4000-8000-000000000005', 'DTP (rappel)', '2022-03-01', 'LOT-DEMO-01', 'a0000000-0000-4000-8000-000000000004');

-- Ordonnance active : le plan de prise est généré automatiquement par trigger ---------
insert into public.prescriptions (id, patient_id, practitioner_id, notes) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000004', 'Revoir dans un mois si les symptômes persistent.');

insert into public.prescription_items (prescription_id, medicament, dosage, voie, horaires, date_debut, date_fin, instructions) values
  ('d0000000-0000-4000-8000-000000000001', 'Paracétamol 1 g', '1 comprimé', 'orale',
   array['08:00', '14:00', '20:00']::time[], current_date, current_date + 4, 'Pas plus de 3 g par jour'),
  ('d0000000-0000-4000-8000-000000000001', 'Vitamine D3 1000 UI', '1 capsule', 'orale',
   array['08:00']::time[], current_date, current_date + 29, 'Pendant le petit-déjeuner');
