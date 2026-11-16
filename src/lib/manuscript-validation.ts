// src/lib/manuscript-validation.ts
// Soumission d'un manuscrit à l'examen éditorial (formule à compte d'éditeur) : textes, libellés et validation.

import { z } from "zod";
import type { ManuscriptStatus } from "@prisma/client";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export const REVIEW_CONSENT_TEXT =
  "J'accepte que mon manuscrit soit examiné par l'équipe éditoriale de TechLibrairie Édition, qui en conserve une copie le temps de l'examen. Je comprends que cet examen n'engage ni la publication de mon livre, ni la conclusion d'un contrat.";

// Nombre maximal de manuscrits qu'un même auteur peut soumettre en 24 heures
export const MAX_SUBMISSIONS_PER_DAY = 5;

export const MANUSCRIPT_STATUS_LABELS: Record<ManuscriptStatus, string> = {
  SUBMITTED: "Reçu",
  IN_REVIEW: "En cours d'examen",
  ACCEPTED: "Retenu",
  REJECTED: "Non retenu",
};

export const MANUSCRIPT_STATUS_STYLES: Record<ManuscriptStatus, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

/** Vérifie qu'une clé de stockage est bien un manuscrit de CE vendeur (dossier manuscrits/<vendeur>/). */
export function isOwnedManuscriptKey(key: string, sellerId: string): boolean {
  return (
    key.startsWith(`manuscrits/${sellerId}/`) &&
    key.toLowerCase().endsWith(".pdf") &&
    !key.includes("..") &&
    !key.includes("\\") &&
    key.length <= 300
  );
}

export const manuscriptFieldsSchema = z.object({
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
  authorName: z
    .string({ required_error: "Le nom de l'auteur est obligatoire." })
    .trim()
    .min(2, "Le nom de l'auteur doit contenir au moins 2 caractères.")
    .max(120, "Le nom de l'auteur est trop long (120 caractères maximum)."),
  capacity: z.enum(["AUTHOR", "THIRD_PARTY_SELLER"], {
    errorMap: () => ({ message: "Indiquez si vous êtes l'auteur ou le titulaire des droits." }),
  }),
  rightsAccepted: z.literal("true", {
    errorMap: () => ({ message: "Vous devez cocher la déclaration des droits." }),
  }),
  reviewConsent: z.literal("true", {
    errorMap: () => ({ message: "Vous devez accepter l'examen de votre manuscrit." }),
  }),
  pdfStorageKey: z
    .string({ required_error: "Le manuscrit est obligatoire." })
    .trim()
    .min(1, "Le manuscrit est obligatoire.")
    .max(500),
  pdfFileName: z
    .string({ required_error: "Le manuscrit est obligatoire." })
    .trim()
    .min(1, "Le manuscrit est obligatoire.")
    .max(200),
  pdfSizeBytes: z.coerce
    .number({ invalid_type_error: "Taille du fichier invalide." })
    .int()
    .positive("Taille du fichier invalide.")
    .max(MAX_PDF_SIZE_BYTES, "Le PDF dépasse la taille maximale de 50 Mo."),
});

export type ManuscriptFields = z.infer<typeof manuscriptFieldsSchema>;
