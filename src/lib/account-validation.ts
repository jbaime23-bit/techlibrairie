// src/lib/account-validation.ts
// Validation des demandes liées au compte (mot de passe oublié, réinitialisation).

import { z } from "zod";

export const newPasswordSchema = z
  .string({ required_error: "Le mot de passe est obligatoire." })
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(100, "Le mot de passe est trop long (100 caractères maximum).")
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre.")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre.");

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "L'adresse email est obligatoire." })
    .trim()
    .toLowerCase()
    .email("Adresse email invalide.")
    .max(254, "Adresse email trop longue."),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: "Lien invalide ou expiré." })
    .regex(/^[a-f0-9]{64}$/, "Lien invalide ou expiré."),
  password: newPasswordSchema,
});
