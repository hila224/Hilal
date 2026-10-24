// Types des données renvoyées par Supabase. Ils suivent les tables de
// supabase/migrations/20261024000001_schema.sql.

export type AppRole = 'patient' | 'medecin' | 'secretaire' | 'admin';
export type AppointmentStatus = 'confirme' | 'annule' | 'honore' | 'absent';
export type IntakeStatus = 'a_prendre' | 'pris' | 'non_pris';
export type PrescriptionStatus = 'active' | 'terminee' | 'annulee';
export type DocumentType = 'compte_rendu' | 'resultat_analyse' | 'imagerie' | 'ordonnance' | 'autre';
export type HistoryType = 'medical' | 'chirurgical' | 'familial';
export type Severity = 'faible' | 'moderee' | 'severe';

export type Profile = {
  id: string;
  role: AppRole;
  prenom: string;
  nom: string;
  telephone: string | null;
};

export type Patient = {
  id: string;
  date_naissance: string | null;
  sexe: 'F' | 'M' | 'X' | null;
  consentement_rgpd_at: string | null;
};

export type Service = {
  id: string;
  nom: string;
  description: string | null;
};

export type Practitioner = {
  id: string;
  specialite: string;
  service_id: string;
  profile: Pick<Profile, 'prenom' | 'nom'> | null;
};

export type Slot = {
  id: string;
  practitioner_id: string;
  debut: string;
  fin: string;
};

export type Appointment = {
  id: string;
  motif: string | null;
  statut: AppointmentStatus;
  slot: Pick<Slot, 'debut' | 'fin'>;
  practitioner: {
    specialite: string;
    profile: Pick<Profile, 'prenom' | 'nom'> | null;
    service: Pick<Service, 'nom'> | null;
  } | null;
};

export type MedicationIntake = {
  id: string;
  prevu_a: string;
  statut: IntakeStatus;
  pris_a: string | null;
  item: Pick<PrescriptionItem, 'medicament' | 'dosage' | 'instructions'> | null;
};

export type PrescriptionItem = {
  id: string;
  medicament: string;
  dosage: string;
  voie: string | null;
  horaires: string[];
  date_debut: string;
  date_fin: string;
  instructions: string | null;
};

export type Prescription = {
  id: string;
  date_prescription: string;
  statut: PrescriptionStatus;
  notes: string | null;
  practitioner_id: string;
  lignes: PrescriptionItem[];
};

export type MedicalDocument = {
  id: string;
  type: DocumentType;
  titre: string;
  storage_path: string;
  created_at: string;
};

/** Résultat de la fonction get_patient_record(). */
export type PatientRecord = {
  identite: { prenom: string; nom: string; date_naissance: string | null; sexe: string | null } | null;
  profil_medical: {
    groupe_sanguin: string | null;
    taille_cm: number | null;
    poids_kg: number | null;
    updated_at: string;
  } | null;
  allergies: { id: string; substance: string; reaction: string | null; severite: Severity | null }[];
  antecedents: { id: string; type: HistoryType; description: string; date_evenement: string | null }[];
  vaccinations: { id: string; vaccin: string; date_administration: string; lot: string | null }[];
  documents: MedicalDocument[];
  ordonnances: Prescription[];
};

export type AuditEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  at: string;
};
