// Accès aux données. Toutes les requêtes passent par la RLS : un patient ne
// reçoit jamais que ses propres données, même si on oublie un filtre ici.
import i18n from '@/i18n';

import { syncMedicationReminders } from './notifications';
import { supabase, unwrap } from './supabase';
import type {
  Appointment,
  AuditEntry,
  IntakeStatus,
  MedicationIntake,
  Patient,
  PatientRecord,
  Practitioner,
  Profile,
  Service,
  Slot,
} from './types';

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error(i18n.t('errors.sessionExpired'));
  return data.session.user.id;
}

// -----------------------------------------------------------------------------
// Rendez-vous
// -----------------------------------------------------------------------------

export async function fetchAppointments() {
  const rows = unwrap<Appointment[]>(
    await supabase
      .from('appointments')
      .select(
        'id, motif, statut, slot:slots(debut, fin), ' +
          'practitioner:practitioners(specialite, profile:profiles(prenom, nom), service:services(nom))'
      )
      .eq('patient_id', await currentUserId())
  );
  const now = Date.now();
  const byDate = (a: Appointment, b: Appointment) => a.slot.debut.localeCompare(b.slot.debut);
  return {
    upcoming: rows.filter((a) => a.statut === 'confirme' && Date.parse(a.slot.debut) > now).sort(byDate),
    past: rows.filter((a) => !(a.statut === 'confirme' && Date.parse(a.slot.debut) > now)).sort(byDate).reverse(),
  };
}

export async function fetchServices() {
  return unwrap<Service[]>(
    await supabase.from('services').select('id, nom, description').eq('actif', true).order('nom')
  );
}

export async function fetchPractitioners(serviceId: string) {
  return unwrap<Practitioner[]>(
    await supabase
      .from('practitioners')
      .select('id, specialite, service_id, profile:profiles(prenom, nom)')
      .eq('service_id', serviceId)
  );
}

/** Créneaux libres des 6 prochaines semaines. */
export async function fetchFreeSlots(practitionerId: string) {
  const from = new Date();
  const to = new Date(from.getTime() + 42 * 24 * 60 * 60 * 1000);
  return unwrap<Slot[]>(
    await supabase
      .from('slots')
      .select('id, practitioner_id, debut, fin')
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

export async function fetchRecord() {
  return unwrap<PatientRecord>(
    await supabase.rpc('get_patient_record', { p_patient_id: await currentUserId() })
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
