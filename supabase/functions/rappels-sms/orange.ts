// Client minimal de l'API SMS d'Orange (offre « SMS Guinea Conakry »).
// Documentation : https://developer.orange.com/apis/sms-gn

export type OrangeConfig = {
  /** https://api.orange.com (modifiable pour les tests). */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Numéro d'expéditeur fourni par Orange, ex. « tel:+2240000 ». */
  senderAddress: string;
  /** Nom d'expéditeur validé par Orange (11 caractères max), facultatif. */
  senderName?: string;
};

export async function getAccessToken(config: OrangeConfig): Promise<string> {
  const response = await fetch(`${config.baseUrl}/oauth/v3/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    throw new Error(`Jeton Orange refusé (${response.status})`);
  }
  const { access_token } = await response.json();
  return access_token;
}

/** Envoie un SMS. `phone` est au format international : +2246XXXXXXXX. */
export async function sendSms(config: OrangeConfig, token: string, phone: string, message: string) {
  const response = await fetch(
    `${config.baseUrl}/smsmessaging/v1/outbound/${encodeURIComponent(config.senderAddress)}/requests`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: `tel:${phone}`,
          senderAddress: config.senderAddress,
          ...(config.senderName ? { senderName: config.senderName } : {}),
          outboundSMSTextMessage: { message },
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Envoi du SMS refusé (${response.status}) : ${await response.text()}`);
  }
}
