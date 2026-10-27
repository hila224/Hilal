import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { LanguagePicker } from '@/components/language-picker';
import { SupportSection } from '@/components/support';
import { ThemedText } from '@/components/themed-text';
import { TreatingDoctorSection } from '@/components/treating-doctor-card';
import { Button, Card, InfoRow, Notice, Screen, Section, TextField } from '@/components/ui';
import { exportMyData, updatePatientPreferences, updatePhone } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFormat } from '@/lib/format';
import { notificationsAllowed, requestNotificationPermission } from '@/lib/notifications';
import { formatPhone } from '@/lib/phone';
import { shareTextFile } from '@/lib/share-file';
import { errorMessage } from '@/lib/supabase';
import { phoneSchema } from '@/lib/validation';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { session, profile, patient, reload, signOut } = useAuth();
  const savedPhone = formatPhone(profile?.telephone);
  const [phone, setPhone] = useState(savedPhone);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [saving, setSaving] = useState<'phone' | 'sms' | 'export' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [notifications, setNotifications] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') notificationsAllowed().then(setNotifications);
  }, []);

  async function run(kind: 'phone' | 'sms' | 'export', action: () => Promise<string | null>) {
    setSaving(kind);
    setMessage(null);
    try {
      const success = await action();
      if (success) setMessage({ tone: 'success', text: success });
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setSaving(null);
    }
  }

  function savePhone() {
    const parsed = phoneSchema().safeParse(phone);
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message);
      return;
    }
    setPhoneError(undefined);
    run('phone', async () => {
      await updatePhone(parsed.data);
      // Sans numéro, plus de SMS possible.
      if (!parsed.data && patient?.rappels_sms) await updatePatientPreferences({ rappels_sms: false });
      await reload();
      setPhone(formatPhone(parsed.data));
      return t('profile.phoneSaved');
    });
  }

  function toggleSms() {
    const enable = !patient?.rappels_sms;
    run('sms', async () => {
      await updatePatientPreferences({ rappels_sms: enable });
      await reload();
      return null;
    });
  }

  function exportData() {
    run('export', async () => {
      const data = await exportMyData();
      const date = new Date().toISOString().slice(0, 10);
      await shareTextFile(`mes-donnees-sante-${date}.json`, JSON.stringify(data, null, 2), t('profile.exportTitle'));
      return null;
    });
  }

  return (
    <Screen title={t('profile.title')}>
      <Section title={t('profile.identity')}>
        <Card>
          <InfoRow label={t('profile.name')} value={`${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim() || '—'} />
          <InfoRow label={t('profile.email')} value={session?.user.email ?? '—'} />
          <InfoRow
            label={t('profile.birthDate')}
            value={patient?.date_naissance ? f.formatDate(patient.date_naissance) : t('common.notProvidedF')}
          />
        </Card>
        <Card onPress={() => router.push('/profil/informations')} accessibilityLabel={t('profile.myInfo')}>
          <ThemedText type="smallBold">{t('profile.myInfo')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('profile.myInfoText')}
          </ThemedText>
        </Card>
        <TextField
          label={`${t('profile.phone')} (+224)`}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={t('profile.phonePlaceholder')}
          error={phoneError}
        />
        <Button
          compact
          variant="secondary"
          label={t('profile.savePhone')}
          onPress={savePhone}
          loading={saving === 'phone'}
          disabled={phone.trim() === savedPhone}
        />
      </Section>

      <Section title={t('language.title')}>
        <LanguagePicker />
      </Section>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <Section title={t('profile.reminders')}>
        <Card>
          <ThemedText type="smallBold">{t('profile.sms')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('profile.smsText')}
          </ThemedText>
          {!profile?.telephone ? (
            <ThemedText type="small" themeColor="warning">
              {t('profile.smsNeedsPhone')}
            </ThemedText>
          ) : patient?.rappels_sms ? (
            <ThemedText type="small" themeColor="success">
              {t('profile.smsOn', { phone: `+224 ${formatPhone(profile.telephone)}` })}
            </ThemedText>
          ) : null}
          <Button
            compact
            variant={patient?.rappels_sms ? 'secondary' : 'primary'}
            label={patient?.rappels_sms ? t('profile.smsDisable') : t('profile.smsEnable')}
            onPress={toggleSms}
            loading={saving === 'sms'}
            disabled={!profile?.telephone && !patient?.rappels_sms}
          />
        </Card>
        {Platform.OS !== 'web' ? (
          <Card>
            <ThemedText type="smallBold">{t('profile.notifications')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {notifications ? t('profile.notificationsOn') : t('profile.notificationsOff')}
            </ThemedText>
            {notifications === false ? (
              <Button
                compact
                label={t('profile.enableNotifications')}
                onPress={async () => setNotifications(await requestNotificationPermission())}
              />
            ) : null}
          </Card>
        ) : null}
      </Section>

      <TreatingDoctorSection />

      <Section title={t('profile.myData')}>
        <Card onPress={() => router.push('/profil/acces')} accessibilityLabel={t('profile.accessLog')}>
          <ThemedText type="smallBold">{t('profile.accessLog')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('profile.accessLogText')}
          </ThemedText>
        </Card>
        <Button variant="secondary" label={t('profile.download')} onPress={exportData} loading={saving === 'export'} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('profile.deleteInfo')}
        </ThemedText>
      </Section>

      <SupportSection />

      <Button label={t('profile.signOut')} variant="danger" onPress={signOut} />

      <ThemedText type="small" themeColor="textSecondary">
        {f.disclaimer()}
      </ThemedText>
    </Screen>
  );
}
