import { useEffect, useState } from 'react';

/** Heure actuelle, mise à jour toutes les minutes (pour les affichages qui en dépendent). */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
