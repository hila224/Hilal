-- =============================================================================
-- Schéma de base du portail patient-hôpital
-- Modèle inspiré de HL7 FHIR (correspondance indiquée sur chaque table).
-- =============================================================================

create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('patient', 'medecin', 'secretaire', 'admin');
create type public.slot_status as enum ('libre', 'reserve', 'bloque');
create type public.appointment_status as enum ('confirme', 'annule', 'honore', 'absent');
create type public.prescription_status as enum ('active', 'terminee', 'annulee');
create type public.intake_status as enum ('a_prendre', 'pris', 'non_pris');
create type public.document_type as enum ('compte_rendu', 'resultat_analyse', 'imagerie', 'ordonnance', 'autre');
create type public.history_type as enum ('medical', 'chirurgical', 'familial');
create type public.severity as enum ('faible', 'moderee', 'severe');

-- -----------------------------------------------------------------------------
-- Comptes et organisation
-- -----------------------------------------------------------------------------

-- Un profil par compte Supabase Auth. Le rôle ne se modifie que via set_user_role().
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null default 'patient',
  prenom      text not null default '',
  nom         text not null default '',
  telephone   text,
  created_at  timestamptz not null default now()
);

-- FHIR : Organization / HealthcareService
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null unique,
  description  text,
  actif        boolean not null default true
);

-- FHIR : Practitioner / PractitionerRole
create table public.practitioners (
  id          uuid primary key references public.profiles (id) on delete cascade,
  service_id  uuid not null references public.services (id),
  specialite  text not null,
  rpps        text unique -- Répertoire Partagé des Professionnels de Santé
);

-- FHIR : Patient (identité administrative uniquement, visible par le secrétariat)
create table public.patients (
  id                    uuid primary key references public.profiles (id) on delete cascade,
  date_naissance        date,
  sexe                  text check (sexe in ('F', 'M', 'X')),
  ins                   text unique, -- Identifiant National de Santé (production)
  consentement_rgpd_at  timestamptz
);

-- Données médicales de base, séparées de l'identité pour que le secrétariat n'y ait pas accès.
create table public.medical_profiles (
  patient_id      uuid primary key references public.patients (id) on delete cascade,
  groupe_sanguin  text check (groupe_sanguin in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  taille_cm       int check (taille_cm between 30 and 260),
  poids_kg        numeric(5, 1) check (poids_kg between 1 and 400),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id)
);

-- Lien de prise en charge : un médecin n'accède qu'aux dossiers des patients qu'il suit.
-- FHIR : CareTeam
create table public.care_relationships (
  patient_id       uuid not null references public.patients (id) on delete cascade,
  practitioner_id  uuid not null references public.practitioners (id) on delete cascade,
  debut            timestamptz not null default now(),
  primary key (patient_id, practitioner_id)
);
create index on public.care_relationships (practitioner_id);

-- -----------------------------------------------------------------------------
-- Rendez-vous
-- -----------------------------------------------------------------------------

-- FHIR : Slot. Deux créneaux d'un même médecin ne peuvent pas se chevaucher.
create table public.slots (
  id               uuid primary key default gen_random_uuid(),
  practitioner_id  uuid not null references public.practitioners (id) on delete cascade,
  debut            timestamptz not null,
  fin              timestamptz not null,
  statut           public.slot_status not null default 'libre',
  check (fin > debut),
  exclude using gist (practitioner_id with =, tstzrange(debut, fin) with &&)
);
create index on public.slots (practitioner_id, debut);

-- FHIR : Appointment
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  slot_id          uuid not null references public.slots (id),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  practitioner_id  uuid not null references public.practitioners (id),
  motif            text,
  statut           public.appointment_status not null default 'confirme',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Un créneau ne porte qu'un seul rendez-vous non annulé.
create unique index appointments_slot_actif on public.appointments (slot_id) where statut <> 'annule';
create index on public.appointments (patient_id);
create index on public.appointments (practitioner_id);

-- -----------------------------------------------------------------------------
-- Dossier médical
-- -----------------------------------------------------------------------------

-- FHIR : AllergyIntolerance
create table public.allergies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  substance   text not null,
  reaction    text,
  severite    public.severity,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index on public.allergies (patient_id);

-- FHIR : Condition (antécédents)
create table public.medical_history (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  type            public.history_type not null,
  description     text not null,
  date_evenement  date,
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index on public.medical_history (patient_id);

-- FHIR : Immunization
create table public.vaccinations (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references public.patients (id) on delete cascade,
  vaccin               text not null,
  date_administration  date not null,
  lot                  text,
  created_by           uuid not null references public.profiles (id),
  created_at           timestamptz not null default now()
);
create index on public.vaccinations (patient_id);

-- FHIR : DocumentReference. Le fichier est dans le bucket Storage "documents",
-- au chemin "<patient_id>/<nom_du_fichier>".
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  type          public.document_type not null,
  titre         text not null,
  storage_path  text not null unique,
  created_by    uuid not null references public.profiles (id),
  created_at    timestamptz not null default now(),
  check (storage_path like patient_id::text || '/%')
);
create index on public.documents (patient_id);

-- -----------------------------------------------------------------------------
-- Ordonnances et traitements
-- -----------------------------------------------------------------------------

-- FHIR : MedicationRequest (en-tête de l'ordonnance)
create table public.prescriptions (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id) on delete cascade,
  practitioner_id    uuid not null references public.practitioners (id),
  date_prescription  date not null default current_date,
  statut             public.prescription_status not null default 'active',
  notes              text,
  created_at         timestamptz not null default now()
);
create index on public.prescriptions (patient_id);

-- Une ligne par médicament. Les horaires sont en heure de Paris.
-- Une ligne n'est jamais modifiée : pour changer un traitement, on crée une nouvelle ordonnance.
create table public.prescription_items (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references public.prescriptions (id) on delete cascade,
  medicament       text not null,
  dosage           text not null,
  voie             text,
  horaires         time[] not null check (cardinality(horaires) between 1 and 12),
  date_debut       date not null,
  date_fin         date not null,
  instructions     text,
  check (date_fin >= date_debut),
  check (date_fin - date_debut <= 366)
);
create index on public.prescription_items (prescription_id);

-- FHIR : MedicationAdministration. Une ligne par prise prévue.
create table public.medication_intakes (
  id                    uuid primary key default gen_random_uuid(),
  prescription_item_id  uuid not null references public.prescription_items (id) on delete cascade,
  patient_id            uuid not null references public.patients (id) on delete cascade,
  prevu_a               timestamptz not null,
  statut                public.intake_status not null default 'a_prendre',
  pris_a                timestamptz,
  unique (prescription_item_id, prevu_a)
);
create index on public.medication_intakes (patient_id, prevu_a);

-- -----------------------------------------------------------------------------
-- Journal d'audit (FHIR : AuditEvent). Alimenté uniquement par des fonctions serveur.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null, -- INSERT, UPDATE, DELETE, READ, EXPORT
  table_name  text not null,
  record_id   text,
  patient_id  uuid,
  at          timestamptz not null default now()
);
create index on public.audit_log (patient_id, at desc);
