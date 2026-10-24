import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Button, Card, Chips, EmptyState, Notice, Screen, Section, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addService, fetchHospitalCatalog, saveTarif, setServiceActive, setTarifActive } from '@/lib/api-pro';
import { useFormat } from '@/lib/format';
import { useHospital, useHospitalData } from '@/lib/hospital-context';
import { errorMessage } from '@/lib/supabase';
import type { Tarif } from '@/lib/types';
import { priceSchema } from '@/lib/validation';

const GENERAL = 'general';

/** Services proposés et tarifs publiés (en francs guinéens, payés sur place). */
export default function ServicesAndPricesScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { hospital } = useHospital();
  const { data, error, loading, refresh } = useHospitalData((h) => fetchHospitalCatalog(h.id));
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [service, setService] = useState({ nom: '', description: '' });
  const [tarif, setTarif] = useState({ id: undefined as string | undefined, libelle: '', prix: '', service: GENERAL });
  const [priceError, setPriceError] = useState<string | undefined>();

  async function run(key: string, action: () => Promise<void>, success?: string) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      await refresh();
      if (success) setMessage({ tone: 'success', text: success });
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  function submitService() {
    if (!hospital || service.nom.trim().length < 2) return;
    run('service', async () => {
      await addService(hospital.id, service.nom.trim(), service.description.trim());
      setService({ nom: '', description: '' });
    }, t('catalog.serviceAdded'));
  }

  function submitTarif() {
    if (!hospital || tarif.libelle.trim().length < 2) return;
    const price = priceSchema().safeParse(tarif.prix);
    if (!price.success) {
      setPriceError(price.error.issues[0]?.message);
      return;
    }
    setPriceError(undefined);
    run('tarif', async () => {
      await saveTarif({
        id: tarif.id,
        hospital_id: hospital.id,
        service_id: tarif.service === GENERAL ? null : tarif.service,
        libelle: tarif.libelle.trim(),
        prix_gnf: price.data,
      });
      setTarif({ id: undefined, libelle: '', prix: '', service: GENERAL });
    }, t('catalog.priceSaved'));
  }

  function edit(item: Tarif) {
    setTarif({ id: item.id, libelle: item.libelle, prix: String(item.prix_gnf), service: item.service_id ?? GENERAL });
  }

  const services = data?.services ?? [];
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.nom ?? t('catalog.general');

  return (
    <Screen title={t('tabs.servicesPrices')} onRefresh={refresh}>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <AsyncContent loading={loading} error={error} retry={refresh}>
        <Section title={t('catalog.services')}>
          {services.length ? (
            services.map((s) => (
              <Card key={s.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
                  <ThemedText type="smallBold" style={{ flex: 1 }}>
                    {s.nom}
                  </ThemedText>
                  {s.actif ? null : <Badge label={t('catalog.hidden')} tone="warning" />}
                </View>
                {s.description ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.description}
                  </ThemedText>
                ) : null}
                <Button
                  compact
                  variant="secondary"
                  label={s.actif ? t('catalog.hide') : t('catalog.show')}
                  loading={busy === s.id}
                  onPress={() => run(s.id, () => setServiceActive(s.id, !s.actif))}
                />
              </Card>
            ))
          ) : (
            <EmptyState text={t('catalog.noService')} />
          )}
          <Card>
            <TextField label={t('catalog.serviceName')} value={service.nom} onChangeText={(nom) => setService((v) => ({ ...v, nom }))} placeholder={t('catalog.serviceExample')} />
            <TextField
              label={t('catalog.serviceDescription')}
              value={service.description}
              onChangeText={(description) => setService((v) => ({ ...v, description }))}
            />
            <Button compact label={t('catalog.addService')} onPress={submitService} loading={busy === 'service'} disabled={service.nom.trim().length < 2} />
          </Card>
        </Section>

        <Section title={t('catalog.prices')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('catalog.pricesHelp')}
          </ThemedText>
          {data?.tarifs.length ? (
            data.tarifs.map((item) => (
              <Card key={item.id}>
                <Pressable onPress={() => edit(item)} accessibilityRole="button" accessibilityLabel={t('catalog.editPrice', { name: item.libelle })}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
                    <ThemedText type="smallBold" style={{ flex: 1 }}>
                      {item.libelle}
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="primary">
                      {f.formatPrice(item.prix_gnf)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {serviceName(item.service_id)}
                    {item.actif ? '' : ` · ${t('catalog.hidden')}`}
                  </ThemedText>
                </Pressable>
                <Button
                  compact
                  variant="secondary"
                  label={item.actif ? t('catalog.hide') : t('catalog.show')}
                  loading={busy === item.id}
                  onPress={() => run(item.id, () => setTarifActive(item.id, !item.actif))}
                />
              </Card>
            ))
          ) : (
            <EmptyState text={t('catalog.noPrice')} />
          )}

          <Card>
            <ThemedText type="smallBold">{tarif.id ? t('catalog.editTitle') : t('catalog.newPrice')}</ThemedText>
            <TextField label={t('catalog.priceLabel')} value={tarif.libelle} onChangeText={(libelle) => setTarif((v) => ({ ...v, libelle }))} placeholder={t('catalog.priceExample')} />
            <TextField
              label={t('catalog.amount')}
              value={tarif.prix}
              onChangeText={(prix) => setTarif((v) => ({ ...v, prix }))}
              keyboardType="number-pad"
              placeholder="50 000"
              error={priceError}
            />
            <Chips
              options={[{ value: GENERAL, label: t('catalog.general') }, ...services.map((s) => ({ value: s.id, label: s.nom }))]}
              value={tarif.service}
              onChange={(value) => setTarif((v) => ({ ...v, service: value }))}
            />
            <Button compact label={t('catalog.savePrice')} onPress={submitTarif} loading={busy === 'tarif'} disabled={tarif.libelle.trim().length < 2} />
            {tarif.id ? (
              <Button compact variant="secondary" label={t('catalog.cancelEdit')} onPress={() => setTarif({ id: undefined, libelle: '', prix: '', service: GENERAL })} />
            ) : null}
          </Card>
        </Section>
      </AsyncContent>
    </Screen>
  );
}
