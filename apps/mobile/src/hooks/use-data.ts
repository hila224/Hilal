import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/lib/supabase';

/**
 * Charge des données à l'affichage de l'écran (et à chaque retour sur l'écran).
 * `load` doit lever une erreur en cas d'échec.
 */
export function useData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Toujours appeler la dernière version de `load` sans relancer le chargement à chaque rendu.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setData(await loadRef.current());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { data, error, loading: loading && data === null, refresh };
}
