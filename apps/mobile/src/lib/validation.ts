import { z } from 'zod';

import i18n from '@/i18n';

import { normalizePhone } from './phone';

// Les schémas sont construits à l'appel pour que les messages suivent la langue choisie.
export const signUpSchema = () =>
  z
    .object({
      prenom: z.string().trim().min(1, i18n.t('validation.firstName')),
      nom: z.string().trim().min(1, i18n.t('validation.lastName')),
      email: z.email(i18n.t('validation.email')),
      password: z
        .string()
        .min(10, i18n.t('validation.passwordLength'))
        .regex(/[A-Za-z]/, i18n.t('validation.passwordLetter'))
        .regex(/[0-9]/, i18n.t('validation.passwordDigit')),
      confirmation: z.string(),
    })
    .refine((values) => values.password === values.confirmation, {
      path: ['confirmation'],
      message: i18n.t('validation.passwordMatch'),
    });

/** Téléphone facultatif ; une fois saisi, converti au format +2246XXXXXXXX. */
export const phoneSchema = () =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === '') return null;
      const phone = normalizePhone(value);
      if (!phone) {
        context.addIssue({ code: 'custom', message: i18n.t('validation.phone') });
        return z.NEVER;
      }
      return phone;
    });

/** Premier message d'erreur par champ, prêt à afficher sous chaque champ. */
export function fieldErrors<T extends z.ZodType>(schema: T, values: unknown) {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data as z.output<T>, errors: {} as Record<string, string> };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '');
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}
