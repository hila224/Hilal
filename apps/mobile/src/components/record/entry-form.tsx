// Ajout d'une allergie, d'un antécédent, d'un traitement habituel ou d'un vaccin,
// par le patient ou par un médecin qui le suit.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Chips, MultiChips, Notice, TextField } from '@/components/ui';
import { addRecordEntry, type EntryKind } from '@/lib/api-record';
import { errorMessage } from '@/lib/supabase';
import type { HistoryType, Severity } from '@/lib/types';
import { optionalText, readDate } from '@/lib/validation';

const SEVERITIES: Severity[] = ['faible', 'moderee', 'severe'];
const HISTORY_TYPES: HistoryType[] = ['medical', 'chirurgical', 'familial'];

export function EntryForm({ kind, patientId, onDone }: { kind: EntryKind; patientId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [main, setMain] = useState('');
  const [detail, setDetail] = useState('');
  const [date, setDate] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [historyType, setHistoryType] = useState<HistoryType>('medical');
  const [ongoing, setOngoing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    const date_ = readDate(date, { required: kind === 'vaccin', notFuture: true });
    const nextErrors = {
      main: main.trim().length < 2 ? t('validation.required') : undefined,
      date: date_.error,
    };
    setErrors(nextErrors);
    if (nextErrors.main || nextErrors.date) return;

    const values: Record<EntryKind, Record<string, unknown>> = {
      allergie: { substance: main.trim(), reaction: optionalText(detail), severite: severity || null },
      antecedent: { type: historyType, description: main.trim(), date_evenement: date_.value, actif: ongoing },
      traitement: { medicament: main.trim(), posologie: optionalText(detail), depuis: date_.value },
      vaccin: { vaccin: main.trim(), date_administration: date_.value, lot: optionalText(detail) },
    };
    setSaving(true);
    setMessage(null);
    try {
      await addRecordEntry(kind, patientId, values[kind]);
      onDone();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const dateField = (label: string) => (
    <TextField
      label={label}
      value={date}
      onChangeText={setDate}
      placeholder={t('entry.datePlaceholder')}
      keyboardType="numbers-and-punctuation"
      error={errors.date}
    />
  );

  return (
    <>
      {kind === 'allergie' ? (
        <>
          <TextField label={t('entry.substance')} value={main} onChangeText={setMain} error={errors.main} autoFocus />
          <TextField label={t('entry.reaction')} value={detail} onChangeText={setDetail} />
          <ThemedText type="smallBold">{t('entry.severity')}</ThemedText>
          <Chips
            options={[
              { value: '' as const, label: t('record.unknown') },
              ...SEVERITIES.map((value) => ({ value, label: t(`record.severity.${value}`) })),
            ]}
            value={severity}
            onChange={setSeverity}
          />
        </>
      ) : null}

      {kind === 'antecedent' ? (
        <>
          <ThemedText type="smallBold">{t('entry.historyType')}</ThemedText>
          <Chips
            options={HISTORY_TYPES.map((value) => ({ value, label: t(`record.historyType.${value}`) }))}
            value={historyType}
            onChange={setHistoryType}
          />
          <TextField
            label={t('entry.description')}
            value={main}
            onChangeText={setMain}
            placeholder={t('entry.descriptionPlaceholder')}
            error={errors.main}
          />
          {dateField(t('entry.eventDate'))}
          {historyType !== 'familial' ? (
            <MultiChips
              options={[{ value: 'ongoing', label: t('entry.ongoing') }]}
              values={ongoing ? ['ongoing'] : []}
              onChange={(values) => setOngoing(values.length > 0)}
            />
          ) : null}
        </>
      ) : null}

      {kind === 'traitement' ? (
        <>
          <TextField label={t('entry.medicine')} value={main} onChangeText={setMain} error={errors.main} autoFocus />
          <TextField label={t('entry.dosage')} value={detail} onChangeText={setDetail} placeholder={t('entry.dosagePlaceholder')} />
          {dateField(t('entry.since'))}
        </>
      ) : null}

      {kind === 'vaccin' ? (
        <>
          <TextField label={t('entry.vaccine')} value={main} onChangeText={setMain} error={errors.main} autoFocus />
          {dateField(t('entry.vaccineDate'))}
          <TextField label={t('entry.batch')} value={detail} onChangeText={setDetail} />
        </>
      ) : null}

      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button label={t('entry.save')} onPress={save} loading={saving} />
    </>
  );
}
