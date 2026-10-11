// src/lib/product-validation.ts
// Règles de validation d'un produit (utilisables côté navigateur et serveur).

import { z } from "zod";

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo
export const MAX_COVER_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo
export const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const PRODUCT_LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
] as const;

export const PRODUCT_CURRENCIES = [
  { value: "XOF", label: "Franc CFA (XOF)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "Dollar US (USD)" },
] as const;

// Prix minimum et maximum en unité affichée (XOF : francs ; EUR/USD : unités).
export const MIN_PRICE = { XOF: 100, EUR: 1, USD: 1 } as const;
export const MAX_PRICE = { XOF: 10_000_000, EUR: 15_000, USD: 15_000 } as const;

export const productFieldsSchema = z
  .object({
    title: z
      .string({ required_error: "Le titre est obligatoire." })
      .trim()
      .min(3, "Le titre doit contenir au moins 3 caractères.")
      .max(150, "Le titre est trop long (150 caractères maximum)."),
    description: z
      .string({ required_error: "La description est obligatoire." })
      .trim()
      .min(20, "La description doit contenir au moins 20 caractères.")
      .max(5000, "La description est trop longue (5000 caractères maximum)."),
    categoryId: z.string().trim().optional(),
    currency: z.enum(["XOF", "EUR", "USD"], {
      errorMap: () => ({ message: "Choisissez une devise." }),
    }),
    price: z.coerce.number({ invalid_type_error: "Prix invalide." }),
    language: z.enum(["fr", "en"], {
      errorMap: () => ({ message: "Choisissez une langue." }),
    }),
    pageCount: z.coerce
      .number({ invalid_type_error: "Nombre de pages invalide." })
      .int("Le nombre de pages doit être un entier.")
      .min(1, "Le nombre de pages doit être d'au moins 1.")
      .max(10000, "Le nombre de pages est trop élevé.")
      .optional(),
    pdfStorageKey: z
      .string({ required_error: "Le fichier PDF est obligatoire." })
      .trim()
      .min(1, "Le fichier PDF est obligatoire.")
      .max(500),
    pdfFileName: z
      .string({ required_error: "Le fichier PDF est obligatoire." })
      .trim()
      .min(1, "Le fichier PDF est obligatoire.")
      .max(200),
    pdfSizeBytes: z.coerce
      .number({ invalid_type_error: "Taille du PDF invalide." })
      .int()
      .positive("Taille du PDF invalide.")
      .max(MAX_PDF_SIZE_BYTES, "Le PDF dépasse la taille maximale de 50 Mo."),
  })
  .superRefine((data, ctx) => {
    if (!Number.isFinite(data.price)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Prix invalide.",
      });
      return;
    }

    const min = MIN_PRICE[data.currency];
    const max = MAX_PRICE[data.currency];

    if (data.price < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: `Le prix minimum est de ${min} ${data.currency}.`,
      });
    }

    if (data.price > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: `Le prix maximum est de ${max} ${data.currency}.`,
      });
    }

    if (data.currency === "XOF") {
      if (!Number.isInteger(data.price)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Le franc CFA n'a pas de centimes : saisissez un nombre entier.",
        });
      } else if (data.price % 5 !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message:
            "Le prix en FCFA doit être un multiple de 5 (exigence du paiement Mobile Money).",
        });
      }
    } else if (Math.abs(data.price * 100 - Math.round(data.price * 100)) > 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Le prix ne peut pas avoir plus de 2 décimales.",
      });
    }
  });

export type ProductFields = z.infer<typeof productFieldsSchema>;
