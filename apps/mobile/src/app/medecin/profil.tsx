import { useTranslation } from 'react-i18next';

import { AccountSection } from '@/components/pro';
import { ThemedText } from '@/components/themed-text';
import { AsyncContent, Badge, Card, EmptyState, InfoRow, Screen, Section } from '@/components/ui';
import { useData } from '@/hooks/use-data';
import { fetchMyPractice } from '@/lib/api-pro';
import { useFormat } from '@/lib/format';

export default function DoctorProfileScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, error, loading, refresh } = useData(fetchMyPractice);
  const practitioner = data?.practitioner;

  return (
    <Screen title={t('tabs.profile')} onRefresh={refresh}>
      <AsyncContent loading={loading} error={error} retry={refresh}>
        {practitioner ? (
          <Card>
            <ThemedText type="heading">{f.doctorName(practitioner.profile)}</ThemedText>
            <InfoRow label={t('hospitalDoctors.specialty')} value={practitioner.specialite} />
            <InfoRow label={t('hospitalDoctors.orderNumber')} value={practitioner.numero_ordre ?? '—'} />
            {practitioner.garant ? (
              <ThemedText type="small" themeColor="success">
                ✓ {t('doctorSpace.guaranteedBy', { hospital: practitioner.garant.nom })}
              </ThemedText>
            ) : null}
          </Card>
        ) : null}

        <Section title={t('doctorSpace.hospitals')}>
          {data?.affiliations.length ? (
            data.affiliations.map((affiliation) => (
              <Card key={affiliation.hospital_id}>
                <ThemedText type="smallBold">{affiliation.hospital?.nom}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {affiliation.service?.nom} · {[affiliation.hospital?.commune, affiliation.hospital?.ville].filter(Boolean).join(', ')}
                </ThemedText>
                {affiliation.actif ? null : <Badge label={t('hospitalDoctors.inactive')} tone="warning" />}
              </Card>
            ))
          ) : (
            <EmptyState text={t('doctorSpace.noHospital')} />
          )}
        </Section>
      </AsyncContent>

      <AccountSection />
    </Screen>
  );
}
