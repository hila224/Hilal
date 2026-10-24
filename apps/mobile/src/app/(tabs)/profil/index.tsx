import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, InfoRow, MEDICAL_DISCLAIMER, Notice, Screen, Section, TextField } from '@/components/ui';
import { exportMyData, updatePhone } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { notificationsAllowed, requestNotificationPermission } from '@/lib/notifications';
import { shareTextFile } from '@/lib/share-file';
import { errorMessage } from '@/lib/supabase';
import { phoneSchema } from '@/lib/validation';

export default function ProfileScreen() {
  const { session, profile, patient, reload, signOut } = useAuth();
  const [phone, setPhone] = useState(profile?.telephone ?? '');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [savingPhone, setSavingPhone] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reminders, setReminders] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') notificationsAllowed().then(setReminders);
  }, []);

  async function savePhone() {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message);
      return;
    }
    setPhoneError(undefined);
    setSavingPhone(true);
    try {
      await updatePhone(parsed.data);
      await reload();
      setMessage({ tone: 'success', text: 'Téléphone enregistré.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setSavingPhone(false);
    }
  }

  async function exportData() {
    setExporting(true);
    setMessage(null);
    try {
      const data = await exportMyData();
      const date = new Date().toISOString().slice(0, 10);
      await shareTextFile(`mes-donnees-sante-${date}.json`, JSON.stringify(data, null, 2));
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen title="Profil">
      <Section title="Mon identité">
        <Card>
          <InfoRow label="Nom" value={`${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim() || '—'} />
          <InfoRow label="E-mail" value={session?.user.email ?? '—'} />
          <InfoRow
            label="Date de naissance"
            value={patient?.date_naissance ? formatDate(patient.date_naissance) : 'Non renseignée'}
          />
        </Card>
        <TextField
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          error={phoneError}
        />
        <Button
          compact
          variant="secondary"
          label="Enregistrer le téléphone"
          onPress={savePhone}
          loading={savingPhone}
          disabled={phone === (profile?.telephone ?? '')}
        />
      </Section>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {Platform.OS !== 'web' ? (
        <Section title="Rappels de médicaments">
          <Card>
            <ThemedText type="small">
              {reminders
                ? 'Activés : vous recevez une notification à l’heure de chaque prise.'
                : 'Désactivés. Activez-les pour ne pas oublier vos médicaments.'}
            </ThemedText>
            {reminders === false ? (
              <Button
                compact
                label="Activer les rappels"
                onPress={async () => setReminders(await requestNotificationPermission())}
              />
            ) : null}
          </Card>
        </Section>
      ) : null}

      <Section title="Mes données (RGPD)">
        <Card onPress={() => router.push('/profil/acces')} accessibilityLabel="Voir qui a consulté mon dossier">
          <ThemedText type="smallBold">Qui a consulté mon dossier ›</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Chaque consultation par un soignant est enregistrée.
          </ThemedText>
        </Card>
        <Button
          variant="secondary"
          label="Télécharger toutes mes données"
          onPress={exportData}
          loading={exporting}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Pour supprimer votre compte, contactez le délégué à la protection des données de
          l’hôpital. Le dossier médical doit légalement être conservé 20 ans.
        </ThemedText>
      </Section>

      <Button label="Se déconnecter" variant="danger" onPress={signOut} />

      <ThemedText type="small" themeColor="textSecondary">
        {MEDICAL_DISCLAIMER}
      </ThemedText>
    </Screen>
  );
}
