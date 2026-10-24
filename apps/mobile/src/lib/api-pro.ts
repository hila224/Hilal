// Accès aux données des espaces établissement, médecin et administrateur, et
// messagerie (commune aux patients et aux médecins). La RLS limite chaque
// établissement à ses propres données.
import { APPOINTMENT_FIELDS, currentUserId, splitAppointments } from './api';
import { supabase, unwrap } from './supabase';
import type {
  Appointment,
  DoctorInvitation,
  Hospital,
  HospitalDoctor,
  Message,
  Practitioner,
  Profile,
  Service,
  Tarif,
} from './types';

const PRO_APPOINTMENT_FIELDS = `${APPOINTMENT_FIELDS}, patient:patients(id, profile:profiles(prenom, nom, telephone))`;

// -----------------------------------------------------------------------------
// Établissement
// -----------------------------------------------------------------------------

/** Établissement géré par le compte connecté. */
export async function fetchMyHospital() {
  const rows = unwrap<{ hospital: Hospital | null }[]>(
    await supabase.from('hospital_members').select('hospital:hospitals(*)').eq('user_id', await currentUserId()).limit(1)
  );
  const hospital = rows[0]?.hospital;
  if (!hospital) throw new Error('Aucun établissement associé à ce compte.');
  return hospital;
}

export type HospitalUpdate = Partial<
  Pick<Hospital, 'nom' | 'type' | 'ville' | 'commune' | 'adresse' | 'telephone' | 'email' | 'description' | 'horaires' | 'urgences_24h' | 'paiements'>
>;

export async function updateHospital(id: string, fields: HospitalUpdate) {
  unwrap(await supabase.from('hospitals').update(fields).eq('id', id));
}

export async function fetchHospitalCatalog(hospitalId: string) {
  const [services, tarifs] = await Promise.all([
    supabase.from('services').select('id, hospital_id, nom, description, actif').eq('hospital_id', hospitalId).order('nom'),
    supabase.from('tarifs').select('*').eq('hospital_id', hospitalId).order('libelle'),
  ]);
  return { services: unwrap<Service[]>(services), tarifs: unwrap<Tarif[]>(tarifs) };
}

export async function addService(hospitalId: string, nom: string, description: string) {
  unwrap(await supabase.from('services').insert({ hospital_id: hospitalId, nom, description: description || null }));
}

export async function setServiceActive(id: string, actif: boolean) {
  unwrap(await supabase.from('services').update({ actif }).eq('id', id));
}

export async function saveTarif(tarif: Pick<Tarif, 'hospital_id' | 'service_id' | 'libelle' | 'prix_gnf'> & { id?: string }) {
  const { id, ...fields } = tarif;
  unwrap(id ? await supabase.from('tarifs').update(fields).eq('id', id) : await supabase.from('tarifs').insert(fields));
}

export async function setTarifActive(id: string, actif: boolean) {
  unwrap(await supabase.from('tarifs').update({ actif }).eq('id', id));
}

export async function fetchHospitalDoctors(hospitalId: string) {
  const [doctors, invitations] = await Promise.all([
    supabase
      .from('hospital_doctors')
      .select('hospital_id, practitioner_id, service_id, actif, practitioner:practitioners(id, specialite, numero_ordre, profile:profiles(prenom, nom)), service:services(nom)')
      .eq('hospital_id', hospitalId),
    supabase.from('doctor_invitations').select('email, prenom, nom, specialite, numero_ordre, service_id, created_at').eq('hospital_id', hospitalId),
  ]);
  return { doctors: unwrap<HospitalDoctor[]>(doctors), invitations: unwrap<DoctorInvitation[]>(invitations) };
}

export type NewDoctor = { email: string; prenom: string; nom: string; specialite: string; numero_ordre: string; service_id: string };

/** Renvoie « affilie » (compte existant) ou « invite » (compte créé à l'inscription du médecin). */
export async function addDoctor(hospitalId: string, doctor: NewDoctor) {
  return unwrap<'affilie' | 'invite'>(
    await supabase.rpc('add_doctor', {
      p_hospital_id: hospitalId,
      p_email: doctor.email,
      p_prenom: doctor.prenom,
      p_nom: doctor.nom,
      p_specialite: doctor.specialite,
      p_numero_ordre: doctor.numero_ordre,
      p_service_id: doctor.service_id,
    })
  );
}

export async function setDoctorActive(hospitalId: string, practitionerId: string, actif: boolean) {
  unwrap(
    await supabase.from('hospital_doctors').update({ actif }).eq('hospital_id', hospitalId).eq('practitioner_id', practitionerId)
  );
}

export async function deleteInvitation(hospitalId: string, email: string) {
  unwrap(await supabase.from('doctor_invitations').delete().eq('hospital_id', hospitalId).eq('email', email));
}

export type SlotPlan = {
  hospitalId: string;
  practitionerId: string;
  from: string; // AAAA-MM-JJ
  to: string;
  startTime: string; // HH:MM
  endTime: string;
  minutes: number;
  days: number[]; // 1 = lundi … 7 = dimanche
};

export async function generateSlots(plan: SlotPlan) {
  return unwrap<number>(
    await supabase.rpc('generate_slots', {
      p_hospital_id: plan.hospitalId,
      p_practitioner_id: plan.practitionerId,
      p_date_debut: plan.from,
      p_date_fin: plan.to,
      p_heure_debut: plan.startTime,
      p_heure_fin: plan.endTime,
      p_duree_minutes: plan.minutes,
      p_jours: plan.days,
    })
  );
}

export async function fetchHospitalAppointments(hospitalId: string) {
  const rows = unwrap<Appointment[]>(
    await supabase.from('appointments').select(PRO_APPOINTMENT_FIELDS).eq('hospital_id', hospitalId)
  );
  return splitAppointments(rows);
}

// -----------------------------------------------------------------------------
// Médecin
// -----------------------------------------------------------------------------

export async function fetchDoctorAppointments() {
  const rows = unwrap<Appointment[]>(
    await supabase.from('appointments').select(PRO_APPOINTMENT_FIELDS).eq('practitioner_id', await currentUserId())
  );
  return splitAppointments(rows);
}

export type FollowedPatient = { id: string; prenom: string; nom: string; telephone: string | null; depuis: string };

export async function fetchMyPatients(): Promise<FollowedPatient[]> {
  const rows = unwrap<{ debut: string; patient: { id: string; profile: Pick<Profile, 'prenom' | 'nom' | 'telephone'> | null } | null }[]>(
    await supabase
      .from('care_relationships')
      .select('debut, patient:patients(id, profile:profiles(prenom, nom, telephone))')
      .eq('practitioner_id', await currentUserId())
  );
  return rows
    .filter((row) => row.patient)
    .map((row) => ({
      id: row.patient!.id,
      prenom: row.patient!.profile?.prenom ?? '',
      nom: row.patient!.profile?.nom ?? '',
      telephone: row.patient!.profile?.telephone ?? null,
      depuis: row.debut,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

export async function fetchMyPractice() {
  const uid = await currentUserId();
  const [practitioner, affiliations] = await Promise.all([
    supabase.from('practitioners').select('id, specialite, numero_ordre, profile:profiles(prenom, nom), garant:hospitals!practitioners_garant_hospital_id_fkey(nom)').eq('id', uid).single(),
    supabase
      .from('hospital_doctors')
      .select('hospital_id, practitioner_id, service_id, actif, service:services(nom), hospital:hospitals(nom, ville, commune)')
      .eq('practitioner_id', uid),
  ]);
  return {
    practitioner: unwrap<Practitioner & { garant: { nom: string } | null }>(practitioner),
    affiliations: unwrap<HospitalDoctor[]>(affiliations),
  };
}

// -----------------------------------------------------------------------------
// Messagerie
// -----------------------------------------------------------------------------

export type Conversation = {
  patientId: string;
  practitionerId: string;
  /** Nom de l'interlocuteur. */
  name: string;
  last: Message;
  unread: number;
};

/** Conversations du compte connecté (patient ou médecin), la plus récente en premier. */
export async function fetchConversations(): Promise<Conversation[]> {
  const uid = await currentUserId();
  const messages = unwrap<Message[]>(
    await supabase.from('messages').select('*').or(`patient_id.eq.${uid},practitioner_id.eq.${uid}`).order('created_at', { ascending: false }).limit(500)
  );
  const byPair = new Map<string, Conversation>();
  for (const message of messages) {
    const key = `${message.patient_id}/${message.practitioner_id}`;
    const conversation = byPair.get(key) ?? {
      patientId: message.patient_id,
      practitionerId: message.practitioner_id,
      name: '',
      last: message,
      unread: 0,
    };
    if (message.auteur_id !== uid && !message.lu_at) conversation.unread += 1;
    byPair.set(key, conversation);
  }
  const conversations = [...byPair.values()];
  const otherIds = conversations.map((c) => (c.patientId === uid ? c.practitionerId : c.patientId));
  if (otherIds.length) {
    const people = unwrap<Pick<Profile, 'id' | 'prenom' | 'nom'>[]>(
      await supabase.from('profiles').select('id, prenom, nom').in('id', otherIds)
    );
    for (const conversation of conversations) {
      const otherId = conversation.patientId === uid ? conversation.practitionerId : conversation.patientId;
      const person = people.find((p) => p.id === otherId);
      conversation.name = person ? `${person.prenom} ${person.nom}`.trim() : '';
    }
  }
  return conversations;
}

export async function fetchMessages(patientId: string, practitionerId: string) {
  return unwrap<Message[]>(
    await supabase
      .from('messages')
      .select('*')
      .eq('patient_id', patientId)
      .eq('practitioner_id', practitionerId)
      .order('created_at')
  );
}

export async function sendMessage(patientId: string, practitionerId: string, contenu: string) {
  unwrap(
    await supabase
      .from('messages')
      .insert({ patient_id: patientId, practitioner_id: practitionerId, auteur_id: await currentUserId(), contenu })
  );
}

export async function markMessagesRead(patientId: string, practitionerId: string) {
  unwrap(await supabase.rpc('mark_messages_read', { p_patient_id: patientId, p_practitioner_id: practitionerId }));
}

export async function fetchProfileName(id: string) {
  const rows = unwrap<Pick<Profile, 'prenom' | 'nom'>[]>(await supabase.from('profiles').select('prenom, nom').eq('id', id));
  return rows[0] ? `${rows[0].prenom} ${rows[0].nom}`.trim() : '';
}

// -----------------------------------------------------------------------------
// Administration de la plateforme
// -----------------------------------------------------------------------------

export type HospitalWithManagers = Hospital & { members: { profile: Pick<Profile, 'prenom' | 'nom' | 'telephone'> | null }[] };

export async function fetchAllHospitals() {
  return unwrap<HospitalWithManagers[]>(
    await supabase
      .from('hospitals')
      .select('*, members:hospital_members(profile:profiles(prenom, nom, telephone))')
      .order('created_at', { ascending: false })
  );
}

export async function reviewHospital(id: string, statut: 'valide' | 'refuse' | 'suspendu', motif?: string) {
  unwrap(await supabase.rpc('review_hospital', { p_hospital_id: id, p_statut: statut, p_motif: motif ?? null }));
}
