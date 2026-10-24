import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Card, EmptyState, Notice, Screen, Section, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bookAppointment, fetchFreeSlots, fetchPractitioners, fetchServices } from '@/lib/api';
import { dayKey, doctorName, formatDateTime, formatDay, formatTime } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { Practitioner, Service, Slot } from '@/lib/types';

/** Charge une liste quand `key` change ; ne fait rien tant que `key` est null. */
function useList<T>(key: string | null, load: (key: string) => Promise<T[]>) {
  const [state, setState] = useState<{ key: string | null; items: T[] | null; error: string | null }>({
    key: null,
    items: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    load(key)
      .then((items) => active && setState({ key, items, error: null }))
      .catch((e) => active && setState({ key, items: null, error: errorMessage(e) }));
    return () => {
      active = false;
    };
    // `load` est une fonction de module stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const current = state.key === key;
  return {
    items: current ? state.items : null,
    error: current ? state.error : null,
    loading: key !== null && (!current || (state.items === null && state.error === null)),
    retry: () => setAttempt((n) => n + 1),
  };
}

export default function NewAppointmentScreen() {
  const [service, setService] = useState<Service | null>(null);
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [motif, setMotif] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const services = useList('all', fetchServices);
  const practitioners = useList(service?.id ?? null, fetchPractitioners);
  const slots = useList(practitioner?.id ?? null, fetchFreeSlots);

  async function confirmBooking() {
    if (!slot) return;
    setBooking(true);
    setError(null);
    try {
      await bookAppointment(slot.id, motif);
      setBooked(true);
    } catch (e) {
      setError(errorMessage(e));
      // Le créneau a peut-être été pris entre-temps : on recharge la liste.
      setSlot(null);
      slots.retry();
    } finally {
      setBooking(false);
    }
  }

  if (booked && slot && practitioner) {
    return (
      <Screen edgeTop={false}>
        <Notice tone="success">
          Rendez-vous confirmé le {formatDateTime(slot.debut)} avec {doctorName(practitioner.profile)}.
        </Notice>
        <ThemedText type="small" themeColor="textSecondary">
          Ce médecin a désormais accès à votre dossier médical pour préparer la consultation.
        </ThemedText>
        <Button label="Voir mes rendez-vous" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edgeTop={false}>
      {/* Étape 1 : service */}
      <Section title="1. Service">
        {service ? (
          <Choice label={service.nom} onChange={() => { setService(null); setPractitioner(null); setSlot(null); }} />
        ) : (
          <AsyncContent loading={services.loading} error={services.error} retry={services.retry}>
            {services.items?.map((s) => (
              <Card key={s.id} onPress={() => setService(s)} accessibilityLabel={`Service ${s.nom}`}>
                <ThemedText type="heading">{s.nom}</ThemedText>
                {s.description ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.description}
                  </ThemedText>
                ) : null}
              </Card>
            ))}
          </AsyncContent>
        )}
      </Section>

      {/* Étape 2 : médecin */}
      {service ? (
        <Section title="2. Médecin">
          {practitioner ? (
            <Choice label={doctorName(practitioner.profile)} onChange={() => { setPractitioner(null); setSlot(null); }} />
          ) : (
            <AsyncContent loading={practitioners.loading} error={practitioners.error} retry={practitioners.retry}>
              {practitioners.items?.length ? (
                practitioners.items.map((p) => (
                  <Card key={p.id} onPress={() => setPractitioner(p)} accessibilityLabel={doctorName(p.profile)}>
                    <ThemedText type="heading">{doctorName(p.profile)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.specialite}
                    </ThemedText>
                  </Card>
                ))
              ) : (
                <EmptyState text="Aucun médecin disponible dans ce service." />
              )}
            </AsyncContent>
          )}
        </Section>
      ) : null}

      {/* Étape 3 : créneau */}
      {practitioner ? (
        <Section title="3. Créneau">
          {slot ? (
            <Choice label={formatDateTime(slot.debut)} onChange={() => setSlot(null)} />
          ) : (
            <AsyncContent loading={slots.loading} error={slots.error} retry={slots.retry}>
              {slots.items?.length ? (
                <SlotPicker slots={slots.items} onSelect={setSlot} />
              ) : (
                <EmptyState text="Aucun créneau libre dans les 6 prochaines semaines." />
              )}
            </AsyncContent>
          )}
        </Section>
      ) : null}

      {/* Étape 4 : confirmation */}
      {slot ? (
        <Section title="4. Confirmation">
          <TextField
            label="Motif de la consultation (facultatif)"
            value={motif}
            onChangeText={setMotif}
            placeholder="Ex. : contrôle, douleur, renouvellement…"
            maxLength={200}
            multiline
          />
          <Button label="Confirmer le rendez-vous" onPress={confirmBooking} loading={booking} />
        </Section>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Screen>
  );
}

/** Étape déjà choisie, avec un bouton « Modifier ». */
function Choice({ label, onChange }: { label: string; onChange: () => void }) {
  return (
    <Card style={styles.choice}>
      <ThemedText type="smallBold" style={styles.choiceLabel}>
        ✓ {label}
      </ThemedText>
      <Pressable onPress={onChange} accessibilityRole="button" hitSlop={8}>
        <ThemedText type="link">Modifier</ThemedText>
      </Pressable>
    </Card>
  );
}

/** Créneaux regroupés par jour. */
function SlotPicker({ slots, onSelect }: { slots: Slot[]; onSelect: (slot: Slot) => void }) {
  const theme = useTheme();
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = dayKey(slot.debut);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }

  return (
    <View style={styles.days}>
      {[...days.values()].map((daySlots) => (
        <Card key={daySlots[0].id}>
          <ThemedText type="smallBold">{formatDay(daySlots[0].debut)}</ThemedText>
          <View style={styles.times}>
            {daySlots.map((slot) => (
              <Pressable
                key={slot.id}
                onPress={() => onSelect(slot)}
                accessibilityRole="button"
                accessibilityLabel={formatDateTime(slot.debut)}
                style={({ pressed }) => [
                  styles.time,
                  { borderColor: theme.primary, backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
                ]}>
                <ThemedText type="smallBold" themeColor="primary">
                  {formatTime(slot.debut)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceLabel: {
    flex: 1,
  },
  days: {
    gap: Spacing.two,
  },
  times: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  time: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: 72,
    alignItems: 'center',
  },
});
