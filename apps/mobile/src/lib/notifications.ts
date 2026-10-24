import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Rappels de prise de médicaments : notifications locales planifiées sur le
 * téléphone à partir du plan de prise (table medication_intakes).
 * Aucune donnée ne transite par un serveur de notifications.
 */

const CHANNEL_ID = 'medicaments';
const ID_PREFIX = 'prise-';
const DAYS_AHEAD = 7;
// iOS n'accepte que 64 notifications planifiées par app.
const MAX_SCHEDULED = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function notificationsAllowed() {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Demande l'autorisation d'afficher des notifications. Renvoie true si accordée. */
export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappels de médicaments',
      // eslint-disable-next-line import/namespace -- exporté via un « export * » imbriqué
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { granted } = await Notifications.requestPermissionsAsync();
  if (granted) await syncMedicationReminders();
  return granted;
}

/**
 * Replanifie les rappels des 7 prochains jours. À appeler à l'ouverture de l'app,
 * après une prise et après une déconnexion (la liste est alors vidée).
 */
export async function syncMedicationReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(ID_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );

  const { data: session } = await supabase.auth.getSession();
  if (!session.session || !(await notificationsAllowed())) return;

  const now = new Date();
  const until = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('medication_intakes')
    .select('prevu_a')
    .eq('patient_id', session.session.user.id)
    .eq('statut', 'a_prendre')
    .gt('prevu_a', now.toISOString())
    .lt('prevu_a', until.toISOString())
    .order('prevu_a');
  if (error) throw error;

  // Une seule notification par horaire, même si plusieurs médicaments sont à prendre.
  const countByTime = new Map<string, number>();
  for (const { prevu_a } of data as { prevu_a: string }[]) {
    countByTime.set(prevu_a, (countByTime.get(prevu_a) ?? 0) + 1);
  }

  await Promise.all(
    [...countByTime].slice(0, MAX_SCHEDULED).map(([time, count]) =>
      Notifications.scheduleNotificationAsync({
        identifier: ID_PREFIX + time,
        content: {
          // Texte volontairement neutre : il s'affiche sur l'écran verrouillé.
          title: 'Rappel de traitement',
          body:
            count > 1
              ? `${count} médicaments à prendre. Ouvrez l'app pour le détail.`
              : 'Un médicament à prendre. Ouvrez l\'app pour le détail.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(time),
          channelId: CHANNEL_ID,
        },
      })
    )
  );
}
