import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from './supabase';
import type { Patient, Profile } from './types';

type AuthState = {
  /** true tant que la session enregistrée n'a pas été relue au démarrage. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  patient: Patient | null;
  /** Recharge le profil et l'identité patient (après une modification). */
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  // Compte pour lequel le profil a fini de charger : évite d'afficher un écran
  // avec une session mais sans profil juste après la connexion.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loadAccount = useCallback(async (current: Session | null) => {
    if (!current) {
      setProfile(null);
      setPatient(null);
      setLoadedFor(null);
      return;
    }
    const userId = current.user.id;
    const [profileResult, patientResult] = await Promise.all([
      supabase.from('profiles').select('id, role, prenom, nom, telephone').eq('id', userId).single(),
      supabase
        .from('patients')
        .select('id, date_naissance, sexe, consentement_rgpd_at, langue, rappels_sms, medecin_traitant_id')
        .eq('id', userId)
        .maybeSingle(),
    ]);
    setProfile((profileResult.data as Profile | null) ?? null);
    setPatient((patientResult.data as Patient | null) ?? null);
    setLoadedFor(userId);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadAccount(data.session);
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Ne pas appeler Supabase directement dans ce callback (risque de blocage) :
      // on diffère le chargement du profil.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => loadAccount(next), 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const reload = useCallback(() => loadAccount(session), [loadAccount, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const accountReady = !session || loadedFor === session.user.id;

  return (
    <AuthContext
      value={{ loading: loading || !accountReady, session, profile, patient, reload, signOut }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return context;
}
