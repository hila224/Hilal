import { z } from 'zod';

export const signUpSchema = z
  .object({
    prenom: z.string().trim().min(1, 'Indiquez votre prénom.'),
    nom: z.string().trim().min(1, 'Indiquez votre nom.'),
    email: z.email('Adresse e-mail invalide.'),
    password: z
      .string()
      .min(10, 'Au moins 10 caractères.')
      .regex(/[A-Za-z]/, 'Au moins une lettre.')
      .regex(/[0-9]/, 'Au moins un chiffre.'),
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    path: ['confirmation'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+33\s?|0)[1-9](\s?\d{2}){4}$/, 'Numéro de téléphone français invalide.')
  .or(z.literal(''));

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
