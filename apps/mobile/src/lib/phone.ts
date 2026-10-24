import { PAYS } from '@/constants/pays';

/**
 * Numéro de mobile guinéen (9 chiffres commençant par 6) au format international
 * « +2246XXXXXXXX ». Accepte « 622 12 34 56 », « +224 622 12 34 56 », « 00224… ».
 * Renvoie null si le numéro n'est pas valide.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, '').replace(/^\+/, '').replace(/^00/, '');
  const local = digits.startsWith('224') && digits.length === 12 ? digits.slice(3) : digits;
  return /^6\d{8}$/.test(local) ? `${PAYS.indicatif}${local}` : null;
}

/** « +224622123456 » → « 622 12 34 56 » (affichage). */
export function formatPhone(international: string | null | undefined): string {
  if (!international) return '';
  const local = international.replace(PAYS.indicatif, '');
  return local.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4');
}
