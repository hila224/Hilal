import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { useData } from '@/hooks/use-data';

import { fetchMyHospital } from './api-pro';
import { errorMessage } from './supabase';
import type { Hospital } from './types';

type HospitalState = {
  hospital: Hospital | null;
  error: string | null;
  reload: () => Promise<void>;
};

const HospitalContext = createContext<HospitalState | null>(null);

/** Établissement géré par le compte connecté, partagé par tous les écrans de l'espace établissement. */
export function HospitalProvider({ children }: PropsWithChildren) {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setHospital(await fetchMyHospital());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Premier chargement : l'état n'est modifié qu'à l'arrivée de la réponse.
  useEffect(() => {
    let active = true;
    fetchMyHospital()
      .then((value) => active && setHospital(value))
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, []);

  return <HospitalContext value={{ hospital, error, reload }}>{children}</HospitalContext>;
}

export function useHospital() {
  const context = use(HospitalContext);
  if (!context) throw new Error('useHospital doit être utilisé dans <HospitalProvider>');
  return context;
}

/**
 * Comme useData, pour un chargement qui dépend de l'établissement : relancé dès
 * que l'établissement est connu (il est chargé en même temps que l'écran).
 */
export function useHospitalData<T>(load: (hospital: Hospital) => Promise<T>) {
  const { hospital } = useHospital();
  const result = useData(async () => (hospital ? load(hospital) : null));
  const { refresh } = result;
  const hospitalId = hospital?.id;
  useEffect(() => {
    if (hospitalId) refresh();
  }, [hospitalId, refresh]);
  return { ...result, loading: result.loading || !hospital };
}
