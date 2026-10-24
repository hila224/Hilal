-- =============================================================================
-- Données de démonstration — 100 % FICTIVES (établissements, personnes, numéros).
-- Ne jamais mettre de vraies données ici.
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
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@demo.fr',          'Kadiatou',  'Soumah'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'gestion.dixinn@demo.fr', 'Hawa',      'Keïta'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'dr.camara@demo.fr',      'Fatoumata', 'Camara'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'dr.sylla@demo.fr',       'Ibrahima',  'Sylla'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'mariama@demo.fr',        'Mariama',   'Diallo'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'mamadou@demo.fr',        'Mamadou',   'Bah'),
  ('a0000000-0000-4000-8000-000000000007'::uuid, 'gestion.ratoma@demo.fr', 'Sékou',     'Touré')
) as u (id, email, prenom, nom);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like '%@demo.fr';

-- Le trigger a créé un profil « patient » pour chacun : on ajuste les autres rôles.
update public.profiles set role = 'admin'        where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'gestionnaire' where id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007');
update public.profiles set role = 'medecin'      where id in ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004');
delete from public.patients where id in (
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000007'
);

update public.profiles set telephone = '+224622000101' where id = 'a0000000-0000-4000-8000-000000000005';
update public.patients set date_naissance = '1992-03-08', sexe = 'F', consentement_rgpd_at = now(), langue = 'fr'
where id = 'a0000000-0000-4000-8000-000000000005';
update public.patients set date_naissance = '1981-12-19', sexe = 'M', consentement_rgpd_at = now(), langue = 'ff'
where id = 'a0000000-0000-4000-8000-000000000006';

-- Établissements -------------------------------------------------------------------
insert into public.hospitals (id, nom, type, ville, commune, adresse, telephone, description, horaires,
                              urgences_24h, paiements, numero_agrement, statut, valide_at) values
  ('e0000000-0000-4000-8000-000000000001', 'Hôpital de démonstration de Dixinn', 'hopital_public',
   'Conakry', 'Dixinn', 'Quartier fictif, rue de démonstration', '+224300000001',
   'Établissement fictif utilisé pour la démonstration.', 'Lundi au samedi, 8h – 18h',
   true, array['especes', 'orange_money', 'mtn_momo'], 'DEMO-AGR-001', 'valide', now()),
  ('e0000000-0000-4000-8000-000000000002', 'Clinique de démonstration de Ratoma', 'clinique_privee',
   'Conakry', 'Ratoma', null, '+224300000002',
   'Clinique fictive en attente de validation.', 'Lundi au vendredi, 8h – 17h',
   false, array['especes', 'orange_money', 'carte'], 'DEMO-AGR-002', 'en_attente', null);

insert into public.hospital_members (hospital_id, user_id) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007');

insert into public.services (id, hospital_id, nom, description) values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Médecine générale', 'Consultations de premier recours, paludisme, fièvre'),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Maternité', 'Consultations prénatales et suivi de grossesse'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Pédiatrie', 'Enfants, vaccination et nutrition'),
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'Médecine générale', null);

insert into public.tarifs (hospital_id, service_id, libelle, prix_gnf) values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Consultation de médecine générale', 50000),
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Test de diagnostic rapide du paludisme', 25000),
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Consultation prénatale', 75000),
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Échographie obstétricale', 150000),
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Consultation pédiatrique', 50000),
  ('e0000000-0000-4000-8000-000000000001', null, 'Carnet de santé', 10000);

-- Médecins : l'hôpital de Dixinn se porte garant de leur inscription à l'Ordre.
insert into public.practitioners (id, specialite, numero_ordre, garant_hospital_id, garanti_at) values
  ('a0000000-0000-4000-8000-000000000003', 'Gynécologue-obstétricienne', 'DEMO-ONMG-0003', 'e0000000-0000-4000-8000-000000000001', now()),
  ('a0000000-0000-4000-8000-000000000004', 'Médecin généraliste', 'DEMO-ONMG-0004', 'e0000000-0000-4000-8000-000000000001', now());

insert into public.hospital_doctors (hospital_id, practitioner_id, service_id) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001');

-- Créneaux : 20 prochains jours, du lundi au vendredi, 8h-12h, 30 minutes (heure de Conakry)
insert into public.slots (hospital_id, practitioner_id, debut, fin)
select hd.hospital_id, hd.practitioner_id,
       (d::date + t::time) at time zone public.app_timezone(),
       (d::date + t::time + interval '30 minutes') at time zone public.app_timezone()
from public.hospital_doctors hd
cross join generate_series(current_date + 1, current_date + 20, interval '1 day') d
cross join generate_series(timestamp '2000-01-01 08:00', timestamp '2000-01-01 11:30', interval '30 minutes') t
where extract(isodow from d) < 6;

-- Une consultation passée (honorée) et un rendez-vous à venir pour Mariama -------------
insert into public.slots (id, hospital_id, practitioner_id, debut, fin, statut) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004',
   ((current_date - 3) + time '09:00') at time zone public.app_timezone(),
   ((current_date - 3) + time '09:30') at time zone public.app_timezone(), 'reserve');

insert into public.appointments (slot_id, patient_id, practitioner_id, hospital_id, motif, statut) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001',
   'Fièvre et courbatures depuis 2 jours', 'honore');

with prochain as (
  select id, practitioner_id, hospital_id from public.slots
  where practitioner_id = 'a0000000-0000-4000-8000-000000000003' and statut = 'libre'
  order by debut limit 1
), reserve as (
  update public.slots s set statut = 'reserve' from prochain where s.id = prochain.id
  returning s.id, s.practitioner_id, s.hospital_id
)
insert into public.appointments (slot_id, patient_id, practitioner_id, hospital_id, motif)
select id, 'a0000000-0000-4000-8000-000000000005', practitioner_id, hospital_id, 'Consultation prénatale (5e mois)'
from reserve;

insert into public.care_relationships (patient_id, practitioner_id) values
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003');

-- Le Dr Sylla est le médecin traitant de Mariama ; un premier échange de messages.
update public.patients set medecin_traitant_id = 'a0000000-0000-4000-8000-000000000004'
where id = 'a0000000-0000-4000-8000-000000000005';

insert into public.messages (patient_id, practitioner_id, auteur_id, contenu, created_at, lu_at) values
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005',
   'Bonjour docteur, la fièvre a baissé depuis hier. Dois-je continuer le paracétamol ?', now() - interval '20 hours', now() - interval '18 hours'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'Bonjour Mariama, oui, terminez les 3 jours prévus. Revenez si la fièvre reprend.', now() - interval '18 hours', null);

-- Dossier médical de Mariama (saisi par le Dr Sylla) -------------------------------
insert into public.medical_profiles (patient_id, groupe_sanguin, taille_cm, poids_kg, updated_by) values
  ('a0000000-0000-4000-8000-000000000005', 'O+', 162, 64.0, 'a0000000-0000-4000-8000-000000000004');

insert into public.allergies (patient_id, substance, reaction, severite, created_by) values
  ('a0000000-0000-4000-8000-000000000005', 'Sulfamides', 'Éruption cutanée', 'moderee', 'a0000000-0000-4000-8000-000000000004');

insert into public.medical_history (patient_id, type, description, date_evenement, created_by) values
  ('a0000000-0000-4000-8000-000000000005', 'medical', 'Paludisme simple, traité', '2024-08-20', 'a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000005', 'familial', 'Drépanocytose (frère)', null, 'a0000000-0000-4000-8000-000000000004');

insert into public.vaccinations (patient_id, vaccin, date_administration, lot, created_by) values
  ('a0000000-0000-4000-8000-000000000005', 'Fièvre jaune', '2015-05-12', 'LOT-DEMO-01', 'a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000005', 'Tétanos (VAT 2)', '2026-08-03', 'LOT-DEMO-02', 'a0000000-0000-4000-8000-000000000004');

-- Ordonnance active : le plan de prise est généré automatiquement par trigger ---------
insert into public.prescriptions (id, patient_id, practitioner_id, notes) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000004', 'Revenir si la fièvre persiste après 3 jours de traitement.');

insert into public.prescription_items (prescription_id, medicament, dosage, voie, horaires, date_debut, date_fin, instructions) values
  ('d0000000-0000-4000-8000-000000000001', 'Paracétamol 500 mg', '2 comprimés', 'orale',
   array['08:00', '14:00', '20:00']::time[], current_date, current_date + 2, 'Si fièvre ou douleurs'),
  ('d0000000-0000-4000-8000-000000000001', 'Fer + acide folique', '1 comprimé', 'orale',
   array['08:00']::time[], current_date, current_date + 29, 'Pendant le repas');
