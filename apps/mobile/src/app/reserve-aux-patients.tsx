import { Button, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

/** Affiché si un compte soignant ou administratif se connecte à l'app patient. */
export default function PatientsOnlyScreen() {
  const { signOut } = useAuth();
  return (
    <Screen title="Espace patient">
      <Notice tone="info">
        Cette application est réservée aux patients. Les médecins, le secrétariat et
        l’administration utilisent le portail web de l’hôpital.
      </Notice>
      <Button label="Se déconnecter" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
