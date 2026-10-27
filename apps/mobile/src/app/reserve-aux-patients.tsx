import { useTranslation } from 'react-i18next';

import { SupportSection } from '@/components/support';
import { Button, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

/** Affiché si un compte soignant ou administratif se connecte à l'app patient. */
export default function PatientsOnlyScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <Screen title={t('patientsOnly.title')}>
      <Notice tone="info">{t('patientsOnly.text')}</Notice>
      <SupportSection />
      <Button label={t('profile.signOut')} variant="secondary" onPress={signOut} />
    </Screen>
  );
}
