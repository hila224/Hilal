// Écriture dans le dossier médical, par le patient lui-même ou par un médecin qui le suit.
// Les droits sont vérifiés par la base (RLS) : voir supabase/migrations/20261027000001_dossier_complet.sql.
import { currentUserId } from './api';
import { supabase, unwrap } from './supabase';
import type {
  Allergy,
  Consultation,
  Prescription,
  ConsultationFields,
  DocumentType,
  MedicalDocument,
  MedicalProfile,
  PatientDetails,
  Sex,
} from './types';

// -----------------------------------------------------------------------------
// Identité (patient uniquement)
// -----------------------------------------------------------------------------

export async function updateMyDetails(details: PatientDetails) {
  unwrap(await supabase.from('patients').update(details).eq('id', await currentUserId()));
}

// -----------------------------------------------------------------------------
// Profil médical
// -----------------------------------------------------------------------------

export type MedicalProfileValues = Omit<MedicalProfile, 'updated_at' | 'updated_by' | 'par_patient'>;

export async function fetchMedicalProfile(patientId: string) {
  return unwrap<MedicalProfileValues | null>(
    await supabase
      .from('medical_profiles')
      .select('groupe_sanguin, electrophorese, taille_cm, poids_kg, tabac, alcool, grossesse')
      .eq('patient_id', patientId)
      .maybeSingle()
  );
}

export async function saveMedicalProfile(patientId: string, values: MedicalProfileValues) {
  unwrap(
    await supabase.from('medical_profiles').upsert({
      patient_id: patientId,
      ...values,
      updated_by: await currentUserId(),
      updated_at: new Date().toISOString(),
    })
  );
}

// -----------------------------------------------------------------------------
// Allergies, antécédents, traitements habituels, vaccins
// -----------------------------------------------------------------------------

export type EntryKind = 'allergie' | 'antecedent' | 'traitement' | 'vaccin';

const ENTRY_TABLES: Record<EntryKind, string> = {
  allergie: 'allergies',
  antecedent: 'medical_history',
  traitement: 'traitements_habituels',
  vaccin: 'vaccinations',
};

export const isEntryKind = (value: unknown): value is EntryKind =>
  typeof value === 'string' && value in ENTRY_TABLES;

export async function addRecordEntry(kind: EntryKind, patientId: string, values: Record<string, unknown>) {
  unwrap(
    await supabase.from(ENTRY_TABLES[kind]).insert({ ...values, patient_id: patientId, created_by: await currentUserId() })
  );
}

/** Ex. : marquer un traitement habituel ou une maladie comme terminé. */
export async function updateRecordEntry(kind: EntryKind, id: string, values: Record<string, unknown>) {
  unwrap(await supabase.from(ENTRY_TABLES[kind]).update(values).eq('id', id));
}

export async function removeRecordEntry(kind: EntryKind, id: string) {
  unwrap(await supabase.from(ENTRY_TABLES[kind]).delete().eq('id', id));
}

export async function fetchAllergies(patientId: string) {
  return unwrap<Pick<Allergy, 'id' | 'substance' | 'reaction' | 'severite'>[]>(
    await supabase.from('allergies').select('id, substance, reaction, severite').eq('patient_id', patientId)
  );
}

// -----------------------------------------------------------------------------
// Documents (bucket privé « documents », chemin « <patient_id>/<fichier> »)
// -----------------------------------------------------------------------------

export type PickedFile = { uri: string; name: string; mimeType: string; size?: number | null };

/** Formats acceptés par le bucket. */
export const DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export async function uploadDocument(
  patientId: string,
  file: PickedFile,
  meta: { type: DocumentType; titre: string; description: string | null; consultation_id?: string | null }
) {
  const extension = DOCUMENT_TYPES[file.mimeType];
  if (!extension) throw new Error('unsupported-type');
  const path = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  if (body.byteLength > MAX_DOCUMENT_BYTES) throw new Error('too-large');

  unwrap(await supabase.storage.from('documents').upload(path, body, { contentType: file.mimeType }));
  const { error } = await supabase.from('documents').insert({
    patient_id: patientId,
    type: meta.type,
    titre: meta.titre,
    description: meta.description,
    consultation_id: meta.consultation_id ?? null,
    storage_path: path,
    created_by: await currentUserId(),
  });
  if (error) {
    // Pas de fichier orphelin si l'enregistrement est refusé.
    await supabase.storage.from('documents').remove([path]);
    throw error;
  }
}

export async function deleteDocument(document: Pick<MedicalDocument, 'id' | 'storage_path'>) {
  unwrap(await supabase.storage.from('documents').remove([document.storage_path]));
  unwrap(await supabase.from('documents').delete().eq('id', document.id));
}

// -----------------------------------------------------------------------------
// Consultations et ordonnances (médecin)
// -----------------------------------------------------------------------------

export async function fetchConsultation(id: string) {
  return unwrap<Consultation>(await supabase.from('consultations').select('*').eq('id', id).single());
}

type NamedPractitioner = { specialite: string; profile: { prenom: string; nom: string } | null } | null;

/** Compte rendu complet : la consultation, ses ordonnances et ses documents. */
export async function fetchConsultationDetail(id: string) {
  const [consultation, prescriptions, documents] = await Promise.all([
    supabase
      .from('consultations')
      .select('*, practitioner:practitioners(specialite, profile:profiles(prenom, nom)), hospital:hospitals(nom)')
      .eq('id', id)
      .single(),
    supabase
      .from('prescriptions')
      .select('*, lignes:prescription_items(*), practitioner:practitioners(specialite, profile:profiles(prenom, nom)), hospital:hospitals(nom)')
      .eq('consultation_id', id)
      .order('created_at'),
    supabase
      .from('documents')
      .select('*, auteur:profiles(prenom, nom, role)')
      .eq('consultation_id', id)
      .order('created_at'),
  ]);
  const row = unwrap<Consultation & { practitioner: NamedPractitioner; hospital: { nom: string } | null }>(consultation);
  return {
    consultation: {
      ...row,
      medecin: row.practitioner?.profile ? { ...row.practitioner.profile, specialite: row.practitioner.specialite } : null,
      etablissement: row.hospital?.nom ?? null,
    } satisfies Consultation,
    prescriptions: unwrap<(Prescription & { practitioner: NamedPractitioner; hospital: { nom: string } | null })[]>(prescriptions).map(
      (p) => ({ ...p, prescripteur: p.practitioner?.profile ?? null, etablissement: p.hospital?.nom ?? null }) satisfies Prescription
    ),
    documents: unwrap<MedicalDocument[]>(documents).map((d) => ({ ...d, par_patient: d.created_by === row.patient_id })),
  };
}

/** Crée la consultation (et renvoie son identifiant) ou corrige une consultation existante. */
export async function saveConsultation(
  patientId: string,
  values: ConsultationFields & { hospital_id: string | null; appointment_id: string | null },
  id?: string
): Promise<string> {
  if (id) {
    // L'établissement et le rendez-vous d'origine ne changent plus après la création.
    const { hospital_id: _hospital, appointment_id: _appointment, ...clinical } = values;
    unwrap(await supabase.from('consultations').update(clinical).eq('id', id));
    return id;
  }
  const created = unwrap<{ id: string }>(
    await supabase
      .from('consultations')
      .insert({ ...values, patient_id: patientId, practitioner_id: await currentUserId() })
      .select('id')
      .single()
  );
  return created.id;
}

export type PrescriptionLine = {
  medicament: string;
  dosage: string;
  voie: string | null;
  /** « 08:00 », « 20:00 »… */
  horaires: string[];
  date_debut: string;
  date_fin: string;
  instructions: string | null;
};

export async function createPrescription(
  patientId: string,
  lines: PrescriptionLine[],
  options: { notes: string | null; consultationId: string | null; hospitalId: string | null }
) {
  unwrap(
    await supabase.rpc('create_prescription', {
      p_patient_id: patientId,
      p_items: lines,
      p_notes: options.notes,
      p_consultation_id: options.consultationId,
      p_hospital_id: options.hospitalId,
    })
  );
}

/** Arrête une ordonnance : les prises à venir disparaissent du plan du patient. */
export async function stopPrescription(id: string) {
  unwrap(await supabase.from('prescriptions').update({ statut: 'annulee' }).eq('id', id));
}

// -----------------------------------------------------------------------------
// Contexte des formulaires du médecin
// -----------------------------------------------------------------------------

/** Établissements où le médecin exerce actuellement. */
async function myActiveHospitals() {
  const rows = unwrap<{ hospital_id: string; actif: boolean; hospital: { nom: string } | null }[]>(
    await supabase.from('hospital_doctors').select('hospital_id, actif, hospital:hospitals(nom)').eq('practitioner_id', await currentUserId())
  );
  return rows.filter((row) => row.actif).map((row) => ({ id: row.hospital_id, nom: row.hospital?.nom ?? '' }));
}

/**
 * Pour la saisie d'une consultation : établissements du médecin, rendez-vous d'origine,
 * et consultation déjà rédigée (modification, ou rendez-vous déjà documenté).
 */
export async function fetchConsultationContext(options: { consultationId?: string; appointmentId?: string }) {
  const [hospitals, existing, appointment] = await Promise.all([
    myActiveHospitals(),
    options.consultationId
      ? fetchConsultation(options.consultationId)
      : options.appointmentId
        ? supabase.from('consultations').select('*').eq('appointment_id', options.appointmentId).maybeSingle().then((r) => unwrap<Consultation | null>(r))
        : Promise.resolve(null),
    options.appointmentId
      ? supabase
          .from('appointments')
          .select('id, hospital_id, motif, statut')
          .eq('id', options.appointmentId)
          .single()
          .then((r) => unwrap<{ id: string; hospital_id: string; motif: string | null; statut: string }>(r))
      : Promise.resolve(null),
  ]);
  return { hospitals, existing, appointment };
}

/** Pour l'ordonnance : allergies connues, grossesse en cours, établissements du médecin. */
export async function fetchPrescriptionContext(patientId: string) {
  const [allergies, profile, hospitals] = await Promise.all([
    fetchAllergies(patientId),
    fetchMedicalProfile(patientId),
    myActiveHospitals(),
  ]);
  return { allergies, pregnant: !!profile?.grossesse, hospitals };
}

/** Sexe du patient (pour proposer la grossesse dans le profil médical). */
export async function fetchPatientSex(patientId: string) {
  const row = unwrap<{ sexe: Sex | null } | null>(await supabase.from('patients').select('sexe').eq('id', patientId).maybeSingle());
  return row?.sexe ?? null;
}
