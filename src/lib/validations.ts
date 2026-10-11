// src/lib/validations.ts
// Schémas de validation partagés entre le navigateur et le serveur.

import { z } from "zod";

const PHONE_REGEX = /^[+0-9 ()-]{6,30}$/;

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Votre nom doit contenir au moins 2 caractères.")
      .max(80, "Votre nom est trop long (80 caractères maximum)."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Adresse email invalide.")
      .max(254, "Adresse email trop longue."),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
      .max(100, "Le mot de passe est trop long (100 caractères maximum).")
      .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre.")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre."),
    confirmPassword: z.string(),
    accountType: z.enum(["BUYER", "SELLER"], {
      errorMap: () => ({ message: "Choisissez un type de compte." }),
    }),
    displayName: z
      .string()
      .trim()
      .max(80, "Le nom public est trop long (80 caractères maximum).")
      .optional(),
    phone: z
      .string()
      .trim()
      .max(30, "Numéro de téléphone trop long.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Les mots de passe ne correspondent pas.",
      });
    }

    if (
      data.accountType === "SELLER" &&
      (!data.displayName || data.displayName.length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["displayName"],
        message:
          "Le nom d'auteur ou d'éditeur est obligatoire (2 caractères minimum).",
      });
    }

    if (data.phone && !PHONE_REGEX.test(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Numéro de téléphone invalide.",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Protège contre les redirections vers un site externe :
 * seules les URL internes (commençant par un seul "/") sont acceptées.
 */
export function safeCallbackUrl(
  value: string | string[] | undefined | null,
  fallback: string = "/"
): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
