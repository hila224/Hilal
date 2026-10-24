// Edge Function « rappels-sms » : envoie par SMS les rappels de prise de
// médicaments qui arrivent à échéance. Appelée toutes les 5 minutes par une
// tâche planifiée (voir docs/SMS.md).
//
// Secrets à définir dans Supabase (Edge Functions > Secrets) :
//   CRON_SECRET            secret partagé avec la tâche planifiée
//   ORANGE_CLIENT_ID       identifiants de l'application Orange Developer
//   ORANGE_CLIENT_SECRET
//   ORANGE_SMS_SENDER      facultatif, par défaut « tel:+2240000 »
//   ORANGE_SMS_SENDER_NAME facultatif, nom d'expéditeur validé par Orange
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { reminderMessage } from './messages.ts';
import { getAccessToken, sendSms, type OrangeConfig } from './orange.ts';

type Reminder = {
  intake_ids: string[];
  telephone: string;
  langue: string;
  prevu_a: string;
  nombre: number;
};

const env = (name: string, fallback?: string) => {
  const value = Deno.env.get(name) ?? fallback;
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
};

Deno.serve(async (request) => {
  // Seule la tâche planifiée connaît ce secret.
  if (request.headers.get('x-cron-secret') !== env('CRON_SECRET')) {
    return new Response('Non autorisé', { status: 401 });
  }

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('claim_sms_reminders');
  if (error) {
    console.error('claim_sms_reminders', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const reminders = (data ?? []) as Reminder[];
  if (reminders.length === 0) return Response.json({ envoyes: 0, echecs: 0 });

  const orange: OrangeConfig = {
    baseUrl: env('ORANGE_API_URL', 'https://api.orange.com'),
    clientId: env('ORANGE_CLIENT_ID'),
    clientSecret: env('ORANGE_CLIENT_SECRET'),
    senderAddress: env('ORANGE_SMS_SENDER', 'tel:+2240000'),
    senderName: Deno.env.get('ORANGE_SMS_SENDER_NAME') || undefined,
  };

  let sent = 0;
  const failed: string[] = [];
  try {
    const token = await getAccessToken(orange);
    for (const reminder of reminders) {
      try {
        await sendSms(orange, token, reminder.telephone, reminderMessage(reminder.langue, reminder.nombre));
        sent += 1;
      } catch (e) {
        console.error('Échec SMS', e);
        failed.push(...reminder.intake_ids);
      }
    }
  } catch (e) {
    // Pas de jeton : aucun SMS n'est parti.
    console.error(e);
    failed.push(...reminders.flatMap((r) => r.intake_ids));
  }

  // Les rappels non envoyés seront retentés au prochain passage (s'ils sont
  // encore dans la fenêtre de 30 minutes).
  if (failed.length) {
    await supabase.rpc('release_sms_reminders', { p_intake_ids: failed });
  }

  return Response.json({ envoyes: sent, echecs: reminders.length - sent });
});
