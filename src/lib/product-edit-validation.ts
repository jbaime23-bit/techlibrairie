// src/lib/product-edit-validation.ts
// Validation de la modification d'un produit (le prix reste en FCFA, multiple de 5).

import { z } from "zod";
import {
  MAX_PDF_SIZE_BYTES,
  MAX_PRICE,
  MIN_PRICE,
} from "@/lib/product-validation";

export const productEditSchema = z
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
    language: z.enum(["fr", "en"], {
      errorMap: () => ({ message: "Choisissez une langue." }),
    }),
    pageCount: z.coerce
      .number({ invalid_type_error: "Nombre de pages invalide." })
      .int("Le nombre de pages doit être un entier.")
      .min(1, "Le nombre de pages doit être d'au moins 1.")
      .max(10000, "Le nombre de pages est trop élevé.")
      .optional(),
    price: z.coerce.number({ invalid_type_error: "Prix invalide." }).optional(),
    removeCover: z.enum(["true", "false"]).optional(),
    newPdfStorageKey: z.string().trim().min(1).max(500).optional(),
    newPdfFileName: z.string().trim().min(1).max(200).optional(),
    newPdfSizeBytes: z.coerce
      .number({ invalid_type_error: "Taille du PDF invalide." })
      .int()
      .positive("Taille du PDF invalide.")
      .max(MAX_PDF_SIZE_BYTES, "Le PDF dépasse la taille maximale de 50 Mo.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.price !== undefined) {
      if (!Number.isFinite(data.price)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Prix invalide.",
        });
      } else {
        if (data.price < MIN_PRICE.XOF) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["price"],
            message: `Le prix minimum est de ${MIN_PRICE.XOF} FCFA.`,
          });
        }
        if (data.price > MAX_PRICE.XOF) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["price"],
            message: `Le prix maximum est de ${MAX_PRICE.XOF} FCFA.`,
          });
        }
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
      }
    }

    if (data.newPdfStorageKey && !data.newPdfFileName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPdfFileName"],
        message: "Nom du fichier PDF manquant.",
      });
    }
  });

export type ProductEditFields = z.infer<typeof productEditSchema>;
