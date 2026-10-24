import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountSection, HospitalStatusBadge } from '@/components/pro';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, InfoRow, LoadingView, MultiChips, Notice, Screen, Section, TextField } from '@/components/ui';
import { updateHospital } from '@/lib/api-pro';
import { useHospital } from '@/lib/hospital-context';
import { formatPhone, normalizeLandline } from '@/lib/phone';
import { errorMessage } from '@/lib/supabase';
import type { Hospital, HospitalType, PaymentMethod } from '@/lib/types';

const TYPES: HospitalType[] = ['hopital_public', 'clinique_privee', 'centre_sante', 'cabinet'];
const PAYMENTS: PaymentMethod[] = ['especes', 'orange_money', 'mtn_momo', 'carte', 'assurance'];

function toForm(hospital: Hospital) {
  return {
    nom: hospital.nom,
    type: hospital.type,
    ville: hospital.ville,
    commune: hospital.commune ?? '',
    adresse: hospital.adresse ?? '',
    telephone: formatPhone(hospital.telephone),
    email: hospital.email ?? '',
    description: hospital.description ?? '',
    horaires: hospital.horaires ?? '',
    urgences_24h: hospital.urgences_24h,
    paiements: hospital.paiements,
  };
}

/** Fiche publique de l'établissement, visible par les patients une fois validée. */
export default function HospitalProfileScreen() {
  const { hospital } = useHospital();
  if (!hospital) return <LoadingView />;
  // Le formulaire démarre avec les valeurs de l'établissement une fois celui-ci chargé.
  return <HospitalProfileForm key={hospital.id} hospital={hospital} />;
}

function HospitalProfileForm({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation();
  const { reload } = useHospital();
  const [form, setForm] = useState(() => toForm(hospital));
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: 'nom' | 'ville' | 'commune' | 'adresse' | 'telephone' | 'email' | 'description' | 'horaires') =>
    (text: string) => setForm((v) => ({ ...v, [key]: text }));

  async function save() {
    const telephone = form.telephone.trim() ? normalizeLandline(form.telephone) : null;
    if (form.telephone.trim() && !telephone) {
      setPhoneError(t('validation.landline'));
      return;
    }
    setPhoneError(undefined);
    setSaving(true);
    setMessage(null);
    try {
      await updateHospital(hospital.id, {
        nom: form.nom.trim(),
        type: form.type,
        ville: form.ville.trim(),
        commune: form.commune.trim() || null,
        adresse: form.adresse.trim() || null,
        telephone,
        email: form.email.trim() || null,
        description: form.description.trim() || null,
        horaires: form.horaires.trim() || null,
        urgences_24h: form.urgences_24h,
        paiements: form.paiements,
      });
      await reload();
      setMessage({ tone: 'success', text: t('hospitalProfile.saved') });
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title={t('tabs.hospitalProfile')}>
      <Card>
        <HospitalStatusBadge statut={hospital.statut} />
        <InfoRow label={t('hospital.licence')} value={hospital.numero_agrement} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('hospitalProfile.licenceLocked')}
        </ThemedText>
      </Card>

      <Section title={t('hospitalProfile.public')}>
        <TextField label={t('hospital.name')} value={form.nom} onChangeText={set('nom')} />
        <ThemedText type="smallBold">{t('hospital.typeLabel')}</ThemedText>
        <Chips
          options={TYPES.map((type) => ({ value: type, label: t(`hospital.type.${type}`) }))}
          value={form.type}
          onChange={(type) => setForm((v) => ({ ...v, type }))}
        />
        <TextField label={t('hospital.city')} value={form.ville} onChangeText={set('ville')} />
        <TextField label={t('hospital.district')} value={form.commune} onChangeText={set('commune')} />
        <TextField label={t('hospital.address')} value={form.adresse} onChangeText={set('adresse')} />
        <TextField label={t('hospital.phone')} value={form.telephone} onChangeText={set('telephone')} keyboardType="phone-pad" error={phoneError} />
        <TextField label={t('auth.email')} value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
        <TextField label={t('hospital.hours')} value={form.horaires} onChangeText={set('horaires')} placeholder={t('hospitalProfile.hoursExample')} />
        <TextField label={t('hospitalProfile.description')} value={form.description} onChangeText={set('description')} multiline />
      </Section>

      <Section title={t('hospital.emergency24')}>
        <Chips
          options={[
            { value: 'oui', label: t('common.yes') },
            { value: 'non', label: t('common.no') },
          ]}
          value={form.urgences_24h ? 'oui' : 'non'}
          onChange={(value) => setForm((v) => ({ ...v, urgences_24h: value === 'oui' }))}
        />
      </Section>

      <Section title={t('hospital.payments')}>
        <MultiChips
          options={PAYMENTS.map((p) => ({ value: p, label: t(`hospital.payment.${p}`) }))}
          values={form.paiements}
          onChange={(paiements) => setForm((v) => ({ ...v, paiements }))}
        />
      </Section>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button label={t('hospitalProfile.save')} onPress={save} loading={saving} />

      <AccountSection />
    </Screen>
  );
}
