import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { secureStorage } from './secure-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Configuration manquante : copiez .env.example en .env et renseignez ' +
      'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_KEY.'
  );
}

// Seule la clé publique (publishable / anon) va dans l'app : la sécurité repose sur la RLS.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Sur mobile, on ne rafraîchit la session que lorsque l'app est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

/** Message d'erreur lisible à partir d'une erreur Supabase / PostgreSQL. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message === 'Invalid login credentials') return 'E-mail ou mot de passe incorrect.';
    if (message.includes('User already registered')) return 'Un compte existe déjà avec cet e-mail.';
    if (message.includes('Email not confirmed')) return 'Confirmez votre adresse e-mail avant de vous connecter.';
    if (message.includes('Failed to fetch') || message.includes('Network request failed')) {
      return 'Connexion impossible. Vérifiez votre accès à Internet.';
    }
    return message;
  }
  return 'Une erreur inattendue est survenue.';
}

/** Transforme le résultat { data, error } de Supabase en valeur ou en exception. */
export function unwrap<T = unknown>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}
