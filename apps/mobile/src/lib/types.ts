// Types des données renvoyées par Supabase. Ils suivent les tables de
// supabase/migrations/.

export type AppRole = 'patient' | 'medecin' | 'gestionnaire' | 'secretaire' | 'admin';
export type HospitalType = 'hopital_public' | 'clinique_privee' | 'centre_sante' | 'cabinet';
export type HospitalStatus = 'en_attente' | 'valide' | 'refuse' | 'suspendu';
export type PaymentMethod = 'especes' | 'orange_money' | 'mtn_momo' | 'carte' | 'assurance';
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

export type Sex = 'F' | 'M' | 'X';
export type MaritalStatus = 'celibataire' | 'marie' | 'divorce' | 'veuf';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
/** Électrophorèse de l'hémoglobine : AS et SS = trait et drépanocytose. */
export type Electrophoresis = 'AA' | 'AS' | 'SS' | 'AC' | 'SC';
export type Tobacco = 'non' | 'ancien' | 'actuel';
export type Alcohol = 'non' | 'occasionnel' | 'regulier';

/** Informations administratives que le patient renseigne lui-même. */
export type PatientDetails = {
  date_naissance: string | null;
  sexe: Sex | null;
  ville: string | null;
  commune: string | null;
  adresse: string | null;
  profession: string | null;
  situation_familiale: MaritalStatus | null;
  contact_urgence_nom: string | null;
  contact_urgence_lien: string | null;
  contact_urgence_tel: string | null;
  assurance: string | null;
  numero_assurance: string | null;
};

export type Patient = PatientDetails & {
  id: string;
  consentement_rgpd_at: string | null;
  /** fr, en, sus (soussou), ff (pular), emk (malinké). */
  langue: string;
  rappels_sms: boolean;
  medecin_traitant_id: string | null;
};

export type Hospital = {
  id: string;
  nom: string;
  type: HospitalType;
  ville: string;
  commune: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  description: string | null;
  horaires: string | null;
  urgences_24h: boolean;
  paiements: PaymentMethod[];
  numero_agrement: string;
  statut: HospitalStatus;
  motif_refus: string | null;
  created_at: string;
};

export type Tarif = {
  id: string;
  hospital_id: string;
  service_id: string | null;
  libelle: string;
  prix_gnf: number;
  description: string | null;
  actif: boolean;
};

export type Service = {
  id: string;
  hospital_id: string;
  nom: string;
  description: string | null;
  actif: boolean;
};

export type Practitioner = {
  id: string;
  specialite: string;
  numero_ordre: string | null;
  profile: Pick<Profile, 'prenom' | 'nom'> | null;
};

/** Médecin rattaché à un établissement (FHIR : PractitionerRole). */
export type HospitalDoctor = {
  hospital_id: string;
  practitioner_id: string;
  service_id: string;
  actif: boolean;
  practitioner: Practitioner | null;
  service: Pick<Service, 'nom'> | null;
  hospital?: Pick<Hospital, 'nom' | 'ville' | 'commune'> | null;
};

export type DoctorInvitation = {
  email: string;
  prenom: string;
  nom: string;
  specialite: string;
  numero_ordre: string;
  service_id: string;
  created_at: string;
};

export type Message = {
  id: string;
  patient_id: string;
  practitioner_id: string;
  auteur_id: string;
  contenu: string;
  created_at: string;
  lu_at: string | null;
};

export type Slot = {
  id: string;
  hospital_id: string;
  practitioner_id: string;
  debut: string;
  fin: string;
};

export type Appointment = {
  id: string;
  motif: string | null;
  statut: AppointmentStatus;
  slot: Pick<Slot, 'debut' | 'fin'>;
  hospital: Pick<Hospital, 'nom' | 'ville' | 'commune'> | null;
  practitioner: {
    specialite: string;
    profile: Pick<Profile, 'prenom' | 'nom'> | null;
  } | null;
  /** Renseigné pour les médecins et les établissements. */
  patient?: { id: string; profile: Pick<Profile, 'prenom' | 'nom' | 'telephone'> | null } | null;
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
  consultation_id: string | null;
  created_at: string;
  prescripteur: Pick<Profile, 'prenom' | 'nom'> | null;
  etablissement: string | null;
  lignes: PrescriptionItem[];
};

/** Qui a saisi un élément du dossier. */
export type RecordAuthor = {
  created_by: string;
  created_at: string;
  par_patient: boolean;
  auteur: (Pick<Profile, 'prenom' | 'nom' | 'role'>) | null;
};

export type Allergy = RecordAuthor & { id: string; substance: string; reaction: string | null; severite: Severity | null };
export type HistoryItem = RecordAuthor & {
  id: string;
  type: HistoryType;
  description: string;
  date_evenement: string | null;
  /** Problème de santé en cours (maladie chronique). */
  actif: boolean;
};
export type HabitualTreatment = RecordAuthor & {
  id: string;
  medicament: string;
  posologie: string | null;
  depuis: string | null;
  actif: boolean;
};
export type Vaccination = RecordAuthor & { id: string; vaccin: string; date_administration: string; lot: string | null };

export type MedicalDocument = RecordAuthor & {
  id: string;
  type: DocumentType;
  titre: string;
  description: string | null;
  storage_path: string;
  consultation_id: string | null;
};

export type MedicalProfile = {
  groupe_sanguin: BloodGroup | null;
  electrophorese: Electrophoresis | null;
  taille_cm: number | null;
  poids_kg: number | null;
  tabac: Tobacco | null;
  alcool: Alcohol | null;
  grossesse: boolean | null;
  updated_at: string;
  updated_by: string | null;
  par_patient: boolean;
};

/** Constantes mesurées en consultation. */
export type Vitals = {
  tension_sys: number | null;
  tension_dia: number | null;
  pouls: number | null;
  temperature: number | null;
  frequence_respiratoire: number | null;
  saturation: number | null;
  /** g/L */
  glycemie: number | null;
  poids_kg: number | null;
  taille_cm: number | null;
};

export type ConsultationFields = Vitals & {
  motif: string;
  histoire: string | null;
  examen: string | null;
  diagnostic: string | null;
  conduite: string | null;
};

export type Consultation = ConsultationFields & {
  id: string;
  patient_id: string;
  practitioner_id: string;
  hospital_id: string | null;
  appointment_id: string | null;
  date_consultation: string;
  updated_at: string;
  medecin: { prenom: string; nom: string; specialite: string } | null;
  etablissement: string | null;
};

export type RecordAppointment = {
  id: string;
  statut: AppointmentStatus;
  motif: string | null;
  debut: string;
  etablissement: string;
  medecin: Pick<Profile, 'prenom' | 'nom'> | null;
  consultation_id: string | null;
};

/** Résultat de la fonction get_patient_record(). */
export type PatientRecord = {
  identite: (PatientDetails & {
    prenom: string;
    nom: string;
    telephone: string | null;
    medecin_traitant: { id: string; prenom: string; nom: string } | null;
  }) | null;
  profil_medical: MedicalProfile | null;
  allergies: Allergy[];
  antecedents: HistoryItem[];
  traitements_habituels: HabitualTreatment[];
  vaccinations: Vaccination[];
  documents: MedicalDocument[];
  consultations: Consultation[];
  ordonnances: Prescription[];
  /** Prises prévues ces 30 derniers jours. */
  observance: { prevues: number; prises: number; non_prises: number };
  rendez_vous: RecordAppointment[];
};

export type AuditEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  at: string;
};
