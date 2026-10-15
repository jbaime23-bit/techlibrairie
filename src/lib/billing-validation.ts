// src/lib/billing-validation.ts
// Informations de facturation exigées par CinetPay pour le paiement par carte.
// Elles sont transmises à CinetPay et ne sont PAS conservées par TechLibrairie.

import { z } from "zod";

export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "BF", label: "Burkina Faso" },
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "ML", label: "Mali" },
  { code: "NE", label: "Niger" },
  { code: "SN", label: "Sénégal" },
  { code: "TG", label: "Togo" },
  { code: "BJ", label: "Bénin" },
  { code: "GN", label: "Guinée" },
  { code: "GH", label: "Ghana" },
  { code: "NG", label: "Nigeria" },
  { code: "CM", label: "Cameroun" },
  { code: "GA", label: "Gabon" },
  { code: "CG", label: "Congo" },
  { code: "CD", label: "RD Congo" },
  { code: "MA", label: "Maroc" },
  { code: "DZ", label: "Algérie" },
  { code: "TN", label: "Tunisie" },
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "CA", label: "Canada" },
  { code: "US", label: "États-Unis" },
];

// Pays pour lesquels l'état (2 lettres) est obligatoire.
export const STATE_REQUIRED_COUNTRIES = ["US", "CA"];

const SAFE_TEXT = /^[^<>{}\\]+$/;

export const billingSchema = z
  .object({
    name: z
      .string({ required_error: "Le nom est obligatoire." })
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(60, "Le nom est trop long.")
      .regex(SAFE_TEXT, "Caractères non autorisés."),
    surname: z
      .string({ required_error: "Le prénom est obligatoire." })
      .trim()
      .min(2, "Le prénom doit contenir au moins 2 caractères.")
      .max(60, "Le prénom est trop long.")
      .regex(SAFE_TEXT, "Caractères non autorisés."),
    phone: z
      .string({ required_error: "Le téléphone est obligatoire." })
      .trim()
      .min(6, "Numéro de téléphone invalide.")
      .max(30, "Numéro de téléphone trop long.")
      .regex(/^[+0-9 ()-]+$/, "Numéro de téléphone invalide."),
    address: z
      .string({ required_error: "L'adresse est obligatoire." })
      .trim()
      .min(5, "L'adresse doit contenir au moins 5 caractères.")
      .max(120, "L'adresse est trop longue.")
      .regex(SAFE_TEXT, "Caractères non autorisés."),
    city: z
      .string({ required_error: "La ville est obligatoire." })
      .trim()
      .min(2, "La ville doit contenir au moins 2 caractères.")
      .max(60, "La ville est trop longue.")
      .regex(SAFE_TEXT, "Caractères non autorisés."),
    country: z
      .string({ required_error: "Le pays est obligatoire." })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Choisissez un pays."),
    state: z.string().trim().toUpperCase().max(2, "L'état s'écrit sur 2 lettres.").optional(),
    zipCode: z
      .string({ required_error: "Le code postal est obligatoire." })
      .trim()
      .min(1, "Le code postal est obligatoire.")
      .max(5, "Le code postal ne peut pas dépasser 5 caractères.")
      .regex(/^[A-Za-z0-9-]+$/, "Code postal invalide."),
  })
  .superRefine((data, ctx) => {
    if (STATE_REQUIRED_COUNTRIES.includes(data.country) && !/^[A-Z]{2}$/.test(data.state ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message: "L'état (2 lettres, par exemple NY ou QC) est obligatoire pour ce pays.",
      });
    }
  });

export type BillingInput = z.infer<typeof billingSchema>;
