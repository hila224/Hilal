import { z } from 'zod';

import i18n from '@/i18n';

import { normalizeLandline, normalizePhone } from './phone';

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

const HOSPITAL_TYPES = ['hopital_public', 'clinique_privee', 'centre_sante', 'cabinet'] as const;

/** Inscription d'un établissement : compte du responsable + fiche de l'établissement. */
export const hospitalSignUpSchema = () =>
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
      etablissement: z.string().trim().min(2, i18n.t('validation.required')),
      type: z.enum(HOSPITAL_TYPES),
      ville: z.string().trim().min(2, i18n.t('validation.required')),
      commune: z.string().trim(),
      telephone: z
        .string()
        .trim()
        .transform((value, context) => {
          const phone = normalizeLandline(value);
          if (!phone) {
            context.addIssue({ code: 'custom', message: i18n.t('validation.landline') });
            return z.NEVER;
          }
          return phone;
        }),
      agrement: z.string().trim().min(3, i18n.t('validation.required')),
    })
    .refine((values) => values.password === values.confirmation, {
      path: ['confirmation'],
      message: i18n.t('validation.passwordMatch'),
    });

/** Médecin enregistré par un établissement. */
export const newDoctorSchema = () =>
  z.object({
    prenom: z.string().trim().min(1, i18n.t('validation.firstName')),
    nom: z.string().trim().min(1, i18n.t('validation.lastName')),
    email: z.email(i18n.t('validation.email')),
    specialite: z.string().trim().min(2, i18n.t('validation.required')),
    numero_ordre: z.string().trim().min(3, i18n.t('validation.orderNumber')),
    service_id: z.string().min(1, i18n.t('validation.required')),
  });

/** Tarif en francs guinéens : « 50 000 », « 50000 » ou « 50.000 ». */
export const priceSchema = () =>
  z
    .string()
    .transform((value) => value.replace(/[\s.,]/g, ''))
    .pipe(z.string().regex(/^\d{1,10}$/, i18n.t('validation.price')))
    .transform(Number);

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
