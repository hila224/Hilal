import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HospitalSummary } from '@/components/pro';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Button, Card, EmptyState, Notice, Screen, Section, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bookAppointment, fetchFreeSlots, fetchHospitalOffer, fetchHospitals, fetchServiceDoctors } from '@/lib/api';
import { dayKey, useFormat } from '@/lib/format';
import { errorMessage } from '@/lib/supabase';
import type { Hospital, HospitalDoctor, Service, Slot, Tarif } from '@/lib/types';

/** Charge une donnée quand `key` change ; ne fait rien tant que `key` est null. */
function useLoad<T>(key: string | null, load: (key: string) => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    load(key)
      .then((data) => active && setState({ key, data, error: null }))
      .catch((e) => active && setState({ key, data: null, error: errorMessage(e) }));
    return () => {
      active = false;
    };
    // `load` est une fonction de module stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key !== null && (!current || (state.data === null && state.error === null)),
    retry: () => setAttempt((n) => n + 1),
  };
}

export default function NewAppointmentScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [doctor, setDoctor] = useState<HospitalDoctor | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [motif, setMotif] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hospitals = useLoad('all', fetchHospitals);
  const offer = useLoad(hospital?.id ?? null, fetchHospitalOffer);
  const doctors = useLoad(hospital && service ? `${hospital.id}/${service.id}` : null, (key) => {
    const [hospitalId, serviceId] = key.split('/');
    return fetchServiceDoctors(hospitalId, serviceId);
  });
  const slots = useLoad(hospital && doctor ? `${hospital.id}/${doctor.practitioner_id}` : null, (key) => {
    const [hospitalId, practitionerId] = key.split('/');
    return fetchFreeSlots(hospitalId, practitionerId);
  });

  const tarifsOf = (serviceId: string) => offer.data?.tarifs.filter((tarif) => tarif.service_id === serviceId) ?? [];
  const generalTarifs = offer.data?.tarifs.filter((tarif) => !tarif.service_id) ?? [];

  const chooseHospital = (value: Hospital | null) => {
    setHospital(value);
    setService(null);
    setDoctor(null);
    setSlot(null);
  };

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

  if (booked && slot && doctor && hospital) {
    return (
      <Screen edgeTop={false}>
        <Notice tone="success">
          {t('booking.confirmedAt', {
            date: f.formatDateTime(slot.debut),
            doctor: f.doctorName(doctor.practitioner?.profile),
            hospital: hospital.nom,
          })}
        </Notice>
        <ThemedText type="small" themeColor="textSecondary">
          {t('booking.accessNote')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('booking.payOnSite')}
        </ThemedText>
        <Button label={t('booking.seeAppointments')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edgeTop={false}>
      {/* Étape 1 : établissement */}
      <Section title={t('booking.stepHospital')}>
        {hospital ? (
          <Card>
            <Choice label={hospital.nom} onChange={() => chooseHospital(null)} />
            <HospitalSummary hospital={hospital} />
          </Card>
        ) : (
          <AsyncContent loading={hospitals.loading} error={hospitals.error} retry={hospitals.retry}>
            {hospitals.data?.length ? (
              hospitals.data.map((h) => (
                <Card key={h.id} onPress={() => chooseHospital(h)} accessibilityLabel={t('booking.hospitalLabel', { name: h.nom })}>
                  <ThemedText type="heading">{h.nom}</ThemedText>
                  <HospitalSummary hospital={h} />
                </Card>
              ))
            ) : (
              <EmptyState text={t('booking.noHospital')} />
            )}
          </AsyncContent>
        )}
      </Section>

      {/* Étape 2 : service, avec ses tarifs */}
      {hospital ? (
        <Section title={t('booking.stepService')}>
          {service ? (
            <Card>
              <Choice label={service.nom} onChange={() => { setService(null); setDoctor(null); setSlot(null); }} />
            </Card>
          ) : (
            <AsyncContent loading={offer.loading} error={offer.error} retry={offer.retry}>
              {offer.data?.services.length ? (
                offer.data.services.map((s) => (
                  <Card key={s.id} onPress={() => setService(s)} accessibilityLabel={t('booking.serviceLabel', { name: s.nom })}>
                    <ThemedText type="heading">{s.nom}</ThemedText>
                    {s.description ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {s.description}
                      </ThemedText>
                    ) : null}
                    <PriceList tarifs={tarifsOf(s.id)} />
                  </Card>
                ))
              ) : (
                <EmptyState text={t('booking.noService')} />
              )}
              {generalTarifs.length ? (
                <Card>
                  <ThemedText type="smallBold">{t('booking.otherPrices')}</ThemedText>
                  <PriceList tarifs={generalTarifs} />
                </Card>
              ) : null}
            </AsyncContent>
          )}
        </Section>
      ) : null}

      {/* Étape 3 : médecin */}
      {service ? (
        <Section title={t('booking.stepDoctor')}>
          {doctor ? (
            <Card>
              <Choice label={f.doctorName(doctor.practitioner?.profile)} onChange={() => { setDoctor(null); setSlot(null); }} />
            </Card>
          ) : (
            <AsyncContent loading={doctors.loading} error={doctors.error} retry={doctors.retry}>
              {doctors.data?.length ? (
                doctors.data.map((d) => (
                  <Card key={d.practitioner_id} onPress={() => setDoctor(d)} accessibilityLabel={f.doctorName(d.practitioner?.profile)}>
                    <ThemedText type="heading">{f.doctorName(d.practitioner?.profile)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {d.practitioner?.specialite}
                    </ThemedText>
                    <ThemedText type="small" themeColor="success">
                      ✓ {t('doctor.verified', { number: d.practitioner?.numero_ordre ?? '—' })}
                    </ThemedText>
                  </Card>
                ))
              ) : (
                <EmptyState text={t('booking.noDoctors')} />
              )}
            </AsyncContent>
          )}
        </Section>
      ) : null}

      {/* Étape 4 : créneau */}
      {doctor ? (
        <Section title={t('booking.stepSlot')}>
          {slot ? (
            <Card>
              <Choice label={f.formatDateTime(slot.debut)} onChange={() => setSlot(null)} />
            </Card>
          ) : (
            <AsyncContent loading={slots.loading} error={slots.error} retry={slots.retry}>
              {slots.data?.length ? (
                <SlotPicker slots={slots.data} onSelect={setSlot} />
              ) : (
                <EmptyState text={t('booking.noSlots')} />
              )}
            </AsyncContent>
          )}
        </Section>
      ) : null}

      {/* Étape 5 : confirmation */}
      {slot && service ? (
        <Section title={t('booking.stepConfirm')}>
          <TextField
            label={t('booking.reasonLabel')}
            value={motif}
            onChangeText={setMotif}
            placeholder={t('booking.reasonPlaceholder')}
            maxLength={200}
            multiline
          />
          {tarifsOf(service.id).length ? (
            <Card>
              <ThemedText type="smallBold">{t('booking.indicativePrices')}</ThemedText>
              <PriceList tarifs={tarifsOf(service.id)} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('booking.payOnSite')}
              </ThemedText>
            </Card>
          ) : null}
          <Button label={t('booking.confirm')} onPress={confirmBooking} loading={booking} />
        </Section>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Screen>
  );
}

/** Tarifs en francs guinéens. */
function PriceList({ tarifs }: { tarifs: Tarif[] }) {
  const f = useFormat();
  if (!tarifs.length) return null;
  return (
    <View style={styles.prices}>
      {tarifs.map((tarif) => (
        <View key={tarif.id} style={styles.priceRow}>
          <ThemedText type="small" style={styles.priceLabel}>
            {tarif.libelle}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="primary">
            {f.formatPrice(tarif.prix_gnf)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Étape déjà choisie, avec un bouton « Modifier ». */
function Choice({ label, onChange }: { label: string; onChange: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.choice}>
      <ThemedText type="smallBold" style={styles.choiceLabel}>
        ✓ {label}
      </ThemedText>
      <Pressable onPress={onChange} accessibilityRole="button" hitSlop={8}>
        <ThemedText type="link">{t('common.change')}</ThemedText>
      </Pressable>
    </View>
  );
}

/** Créneaux regroupés par jour. */
function SlotPicker({ slots, onSelect }: { slots: Slot[]; onSelect: (slot: Slot) => void }) {
  const theme = useTheme();
  const f = useFormat();
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = dayKey(slot.debut);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }

  return (
    <View style={styles.days}>
      {[...days.values()].map((daySlots) => (
        <Card key={daySlots[0].id}>
          <ThemedText type="smallBold">{f.formatDay(daySlots[0].debut)}</ThemedText>
          <View style={styles.times}>
            {daySlots.map((slot) => (
              <Pressable
                key={slot.id}
                onPress={() => onSelect(slot)}
                accessibilityRole="button"
                accessibilityLabel={f.formatDateTime(slot.debut)}
                style={({ pressed }) => [
                  styles.time,
                  { borderColor: theme.primary, backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
                ]}>
                <ThemedText type="smallBold" themeColor="primary">
                  {f.formatTime(slot.debut)}
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
  prices: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  priceLabel: {
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
