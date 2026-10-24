// Accès aux données. Toutes les requêtes passent par la RLS : un patient ne
// reçoit jamais que ses propres données, même si on oublie un filtre ici.
import i18n from '@/i18n';

import { syncMedicationReminders } from './notifications';
import { supabase, unwrap } from './supabase';
import type {
  Appointment,
  AuditEntry,
  Hospital,
  HospitalDoctor,
  IntakeStatus,
  MedicationIntake,
  Patient,
  PatientRecord,
  Practitioner,
  Profile,
  Service,
  Slot,
  Tarif,
} from './types';

export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error(i18n.t('errors.sessionExpired'));
  return data.session.user.id;
}

export const APPOINTMENT_FIELDS =
  'id, motif, statut, slot:slots(debut, fin), hospital:hospitals(nom, ville, commune), ' +
  'practitioner:practitioners(specialite, profile:profiles(prenom, nom))';

const byDate = (a: Appointment, b: Appointment) => a.slot.debut.localeCompare(b.slot.debut);

/** Sépare les rendez-vous à venir (confirmés) de l'historique. */
export function splitAppointments(rows: Appointment[]) {
  const now = Date.now();
  const upcoming = (a: Appointment) => a.statut === 'confirme' && Date.parse(a.slot.debut) > now;
  return {
    upcoming: rows.filter(upcoming).sort(byDate),
    past: rows.filter((a) => !upcoming(a)).sort(byDate).reverse(),
  };
}

// -----------------------------------------------------------------------------
// Rendez-vous
// -----------------------------------------------------------------------------

export async function fetchAppointments() {
  const rows = unwrap<Appointment[]>(
    await supabase.from('appointments').select(APPOINTMENT_FIELDS).eq('patient_id', await currentUserId())
  );
  return splitAppointments(rows);
}

/** Établissements validés (la RLS masque les autres aux patients). */
export async function fetchHospitals() {
  return unwrap<Hospital[]>(
    await supabase.from('hospitals').select('*').eq('statut', 'valide').order('ville').order('nom')
  );
}

/** Services d'un établissement, avec leurs tarifs. */
export async function fetchHospitalOffer(hospitalId: string) {
  const [services, tarifs] = await Promise.all([
    supabase.from('services').select('id, hospital_id, nom, description, actif').eq('hospital_id', hospitalId).eq('actif', true).order('nom'),
    supabase.from('tarifs').select('*').eq('hospital_id', hospitalId).eq('actif', true).order('prix_gnf'),
  ]);
  return { services: unwrap<Service[]>(services), tarifs: unwrap<Tarif[]>(tarifs) };
}

/** Médecins actifs d'un service. */
export async function fetchServiceDoctors(hospitalId: string, serviceId: string) {
  return unwrap<HospitalDoctor[]>(
    await supabase
      .from('hospital_doctors')
      .select('hospital_id, practitioner_id, service_id, actif, practitioner:practitioners(id, specialite, numero_ordre, profile:profiles(prenom, nom)), service:services(nom)')
      .eq('hospital_id', hospitalId)
      .eq('service_id', serviceId)
      .eq('actif', true)
  );
}

/** Créneaux libres des 6 prochaines semaines d'un médecin dans un établissement. */
export async function fetchFreeSlots(hospitalId: string, practitionerId: string) {
  const from = new Date();
  const to = new Date(from.getTime() + 42 * 24 * 60 * 60 * 1000);
  return unwrap<Slot[]>(
    await supabase
      .from('slots')
      .select('id, hospital_id, practitioner_id, debut, fin')
      .eq('hospital_id', hospitalId)
      .eq('practitioner_id', practitionerId)
      .eq('statut', 'libre')
      .gt('debut', from.toISOString())
      .lt('debut', to.toISOString())
      .order('debut')
  );
}

export async function bookAppointment(slotId: string, motif: string) {
  unwrap(await supabase.rpc('book_appointment', { p_slot_id: slotId, p_motif: motif }));
}

export async function cancelAppointment(appointmentId: string) {
  unwrap(await supabase.rpc('cancel_appointment', { p_appointment_id: appointmentId }));
}

export async function setAppointmentStatus(appointmentId: string, statut: 'honore' | 'absent') {
  unwrap(await supabase.rpc('set_appointment_status', { p_appointment_id: appointmentId, p_statut: statut }));
}

// -----------------------------------------------------------------------------
// Médecin traitant
// -----------------------------------------------------------------------------

export type DoctorChoice = Practitioner & { hospitals: string[]; followsMe: boolean };

/** Médecins qu'un patient peut choisir : ceux des établissements validés, ceux qui le suivent en premier. */
export async function fetchDoctorChoices(): Promise<DoctorChoice[]> {
  const uid = await currentUserId();
  const [affiliations, care] = await Promise.all([
    supabase
      .from('hospital_doctors')
      .select('practitioner:practitioners(id, specialite, numero_ordre, profile:profiles(prenom, nom)), hospital:hospitals(nom)')
      .eq('actif', true),
    supabase.from('care_relationships').select('practitioner_id').eq('patient_id', uid),
  ]);
  const followed = new Set(unwrap<{ practitioner_id: string }[]>(care).map((c) => c.practitioner_id));
  const doctors = new Map<string, DoctorChoice>();
  for (const row of unwrap<{ practitioner: Practitioner | null; hospital: { nom: string } | null }[]>(affiliations)) {
    if (!row.practitioner) continue;
    const doctor = doctors.get(row.practitioner.id) ?? {
      ...row.practitioner,
      hospitals: [],
      followsMe: followed.has(row.practitioner.id),
    };
    if (row.hospital) doctor.hospitals.push(row.hospital.nom);
    doctors.set(row.practitioner.id, doctor);
  }
  return [...doctors.values()].sort(
    (a, b) => Number(b.followsMe) - Number(a.followsMe) || (a.profile?.nom ?? '').localeCompare(b.profile?.nom ?? '')
  );
}

export async function setMedecinTraitant(practitionerId: string | null) {
  unwrap(await supabase.rpc('set_medecin_traitant', { p_practitioner_id: practitionerId }));
}

// -----------------------------------------------------------------------------
// Traitements
// -----------------------------------------------------------------------------

export async function fetchIntakes(from: Date, to: Date) {
  return unwrap<MedicationIntake[]>(
    await supabase
      .from('medication_intakes')
      .select('id, prevu_a, statut, pris_a, item:prescription_items(medicament, dosage, instructions)')
      .eq('patient_id', await currentUserId())
      .gte('prevu_a', from.toISOString())
      .lt('prevu_a', to.toISOString())
      .order('prevu_a')
  );
}

export async function recordIntake(intakeId: string, statut: Exclude<IntakeStatus, 'a_prendre'>) {
  unwrap(await supabase.rpc('record_intake', { p_intake_id: intakeId, p_statut: statut }));
  // La prise est faite : son rappel n'a plus lieu d'être.
  syncMedicationReminders().catch(() => {});
}

// -----------------------------------------------------------------------------
// Dossier médical
// -----------------------------------------------------------------------------

/** Dossier du patient connecté, ou d'un patient suivi (médecin : consultation tracée). */
export async function fetchRecord(patientId?: string) {
  return unwrap<PatientRecord>(
    await supabase.rpc('get_patient_record', { p_patient_id: patientId ?? (await currentUserId()) })
  );
}

/** Lien temporaire (5 minutes) vers un document du dossier. */
export async function documentUrl(storagePath: string) {
  const { signedUrl } = unwrap<{ signedUrl: string }>(
    await supabase.storage.from('documents').createSignedUrl(storagePath, 300)
  );
  return signedUrl;
}

// -----------------------------------------------------------------------------
// Profil et RGPD
// -----------------------------------------------------------------------------

/** `telephone` : format +2246XXXXXXXX, ou null pour l'effacer. */
export async function updatePhone(telephone: string | null) {
  unwrap(await supabase.from('profiles').update({ telephone }).eq('id', await currentUserId()));
}

/** Langue de l'app et des SMS, rappels par SMS. */
export async function updatePatientPreferences(preferences: Partial<Pick<Patient, 'langue' | 'rappels_sms'>>) {
  unwrap(await supabase.from('patients').update(preferences).eq('id', await currentUserId()));
}

/** Qui a consulté mon dossier (consultations par un soignant). */
export async function fetchRecordAccesses() {
  const entries = unwrap<AuditEntry[]>(
    await supabase
      .from('audit_log')
      .select('id, actor_id, action, table_name, at')
      .eq('patient_id', await currentUserId())
      .eq('action', 'READ')
      .order('at', { ascending: false })
      .limit(100)
  );
  const actorIds = [...new Set(entries.map((e) => e.actor_id).filter((id): id is string => !!id))];
  const actors = actorIds.length
    ? unwrap<Pick<Profile, 'id' | 'prenom' | 'nom' | 'role'>[]>(
        await supabase.from('profiles').select('id, prenom, nom, role').in('id', actorIds)
      )
    : [];
  return entries.map((entry) => ({ ...entry, actor: actors.find((a) => a.id === entry.actor_id) ?? null }));
}

export async function exportMyData() {
  return unwrap<Record<string, unknown>>(await supabase.rpc('export_my_data'));
}
