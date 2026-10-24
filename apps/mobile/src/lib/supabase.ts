import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import i18n from '@/i18n';

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
    if (message === 'Invalid login credentials') return i18n.t('errors.invalidCredentials');
    if (message.includes('User already registered')) return i18n.t('errors.alreadyRegistered');
    if (message.includes('Email not confirmed')) return i18n.t('errors.emailNotConfirmed');
    if (message.includes('Failed to fetch') || message.includes('Network request failed')) {
      return i18n.t('errors.network');
    }
    // Messages des fonctions serveur (rédigés en français).
    return message;
  }
  return i18n.t('errors.unexpected');
}

/** Transforme le résultat { data, error } de Supabase en valeur ou en exception. */
export function unwrap<T = unknown>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}
