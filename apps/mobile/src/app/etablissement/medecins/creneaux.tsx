import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Chips, MultiChips, Notice, Screen, Section, TextField } from '@/components/ui';
import { generateSlots } from '@/lib/api-pro';
import { dayKey } from '@/lib/format';
import { useHospital } from '@/lib/hospital-context';
import { errorMessage } from '@/lib/supabase';

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ouvre des créneaux de consultation pour un médecin de l'établissement. */
export default function DoctorSlotsScreen() {
  const { t } = useTranslation();
  const { medecin } = useLocalSearchParams<{ medecin: string }>();
  const { hospital } = useHospital();
  const [weeks, setWeeks] = useState('2');
  const [days, setDays] = useState(['1', '2', '3', '4', '5']);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('12:00');
  const [minutes, setMinutes] = useState('30');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!hospital || !medecin) return;
    if (!TIME.test(start) || !TIME.test(end) || start >= end) {
      setError(t('slots.invalidHours'));
      return;
    }
    if (!days.length) {
      setError(t('slots.noDay'));
      return;
    }
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const now = Date.now();
      const count = await generateSlots({
        hospitalId: hospital.id,
        practitionerId: medecin,
        from: dayKey(new Date(now + DAY_MS)),
        to: dayKey(new Date(now + Number(weeks) * 7 * DAY_MS)),
        startTime: start,
        endTime: end,
        minutes: Number(minutes),
        days: days.map(Number),
      });
      setCreated(count);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edgeTop={false}>
      <ThemedText themeColor="textSecondary">{t('slots.intro')}</ThemedText>

      <Section title={t('slots.period')}>
        <Chips
          options={['1', '2', '4', '8'].map((w) => ({ value: w, label: t('slots.weeks', { count: Number(w) }) }))}
          value={weeks}
          onChange={setWeeks}
        />
      </Section>

      <Section title={t('slots.days')}>
        <MultiChips
          options={['1', '2', '3', '4', '5', '6', '7'].map((d) => ({ value: d, label: t(`slots.day${d}` as 'slots.day1') }))}
          values={days}
          onChange={setDays}
        />
      </Section>

      <Section title={t('slots.hours')}>
        <TextField label={t('slots.start')} value={start} onChangeText={setStart} placeholder="08:00" keyboardType="numbers-and-punctuation" />
        <TextField label={t('slots.end')} value={end} onChangeText={setEnd} placeholder="12:00" keyboardType="numbers-and-punctuation" />
      </Section>

      <Section title={t('slots.duration')}>
        <Chips
          options={['15', '20', '30', '45', '60'].map((m) => ({ value: m, label: `${m} min` }))}
          value={minutes}
          onChange={setMinutes}
        />
      </Section>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {created !== null ? <Notice tone="success">{t('slots.created', { count: created })}</Notice> : null}
      <Button label={t('slots.submit')} onPress={submit} loading={submitting} />
    </Screen>
  );
}
