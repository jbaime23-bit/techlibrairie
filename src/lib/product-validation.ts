// src/lib/product-validation.ts
// Règles de validation d'un produit (utilisables côté navigateur et serveur).
// Règle métier : tous les prix sont fixés en FCFA (XOF), sans taxe.
// Deux services : l'édition de livres (qualité, auteur, ISBN, certification BBDA) et la vente de PDF
// (documents et ressources : aucune de ces informations n'est obligatoire).

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
] as const;

// Prix minimum et maximum en FCFA
export const MIN_PRICE = { XOF: 100 } as const;
export const MAX_PRICE = { XOF: 10_000_000 } as const;

// Les deux services de la plateforme
export const PRODUCT_KINDS = [
  {
    value: "BOOK_EDITION",
    label: "Édition de livres",
    description:
      "Faire éditer et publier un livre sur TechLibrairie : contribution de participation unique, ISBN facultatif et certification des droits.",
  },
  {
    value: "PDF_DOCUMENT",
    label: "Vente de PDF",
    description:
      "Déposer et vendre directement des documents et ressources numériques (cours, rapports, guides...).",
  },
] as const;

export type ProductKindValue = (typeof PRODUCT_KINDS)[number]["value"];

// Qualité sous laquelle un ouvrage de l'édition de livres est publié
export const PUBLISHING_CAPACITIES = [
  {
    value: "AUTHOR",
    label: "Auteur",
    description: "Vous avez écrit cet ouvrage et vous en détenez les droits.",
  },
  {
    value: "INDEPENDENT_PUBLISHER",
    label: "Éditeur indépendant",
    description:
      "Vous éditez cet ouvrage pour son ou ses auteurs et vous détenez les droits de diffusion numérique.",
  },
  {
    value: "THIRD_PARTY_SELLER",
    label: "Vendeur tiers",
    description:
      "Vous diffusez l'ouvrage d'une autre personne, avec son autorisation écrite (licence de diffusion).",
  },
] as const;

export type PublishingCapacityValue = (typeof PUBLISHING_CAPACITIES)[number]["value"];

// Textes exacts de la certification : c'est ce texte, et non une copie envoyée par le navigateur,
// qui est enregistré avec la date lors de la publication.
export const RIGHTS_CERTIFICATION_TEXT =
  "Je certifie être l'auteur ou le titulaire des droits de ce document et j'assume l'entière responsabilité de son contenu face aux institutions de régulation (BBDA, dépôt légal, etc.).";

export const DOCUMENT_CERTIFICATION_TEXT =
  "Je certifie être l'auteur ou le titulaire des droits de ce document et j'assume l'entière responsabilité de son contenu.";

/** Texte de certification applicable selon le service. */
export function certificationTextFor(kind: ProductKindValue): string {
  return kind === "BOOK_EDITION" ? RIGHTS_CERTIFICATION_TEXT : DOCUMENT_CERTIFICATION_TEXT;
}

/**
 * Normalise et contrôle un numéro ISBN (ISBN-10 ou ISBN-13, avec ou sans tirets ni préfixe « ISBN »).
 * Renvoie le numéro sans séparateurs, ou null s'il est invalide (longueur ou clé de contrôle).
 */
export function normalizeIsbn(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^isbn(?:-1[03])?\s*:?\s*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();

  if (/^\d{13}$/.test(cleaned)) {
    if (!cleaned.startsWith("978") && !cleaned.startsWith("979")) return null;

    let sum = 0;
    for (let index = 0; index < 12; index += 1) {
      sum += Number(cleaned[index]) * (index % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;

    return check === Number(cleaned[12]) ? cleaned : null;
  }

  if (/^\d{9}[\dX]$/.test(cleaned)) {
    let sum = 0;
    for (let index = 0; index < 10; index += 1) {
      const char = cleaned[index];
      const value = char === "X" ? 10 : Number(char);
      sum += value * (10 - index);
    }

    return sum % 11 === 0 ? cleaned : null;
  }

  return null;
}

export const ISBN_ERROR_MESSAGE =
  "ISBN invalide : saisissez 10 ou 13 chiffres (les tirets sont acceptés), avec une clé de contrôle correcte, ou laissez ce champ vide.";

export const productFieldsSchema = z
  .object({
    kind: z.enum(["BOOK_EDITION", "PDF_DOCUMENT"], {
      errorMap: () => ({
        message: "Choisissez le service : édition de livres ou vente de PDF.",
      }),
    }),
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
    currency: z.enum(["XOF"], {
      errorMap: () => ({ message: "Les prix sont fixés en FCFA." }),
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
    // Édition de livres seulement : qualité du déposant (contrôlée plus bas).
    publishingCapacity: z
      .enum(["AUTHOR", "INDEPENDENT_PUBLISHER", "THIRD_PARTY_SELLER"], {
        errorMap: () => ({
          message: "Choisissez votre qualité : auteur, éditeur indépendant ou vendeur tiers.",
        }),
      })
      .optional(),
    // Obligatoire pour l'édition de livres, facultatif pour la vente de PDF (contrôlé plus bas).
    authorName: z
      .string()
      .trim()
      .max(120, "Le nom de l'auteur est trop long (120 caractères maximum).")
      .optional(),
    // Édition de livres seulement : ignoré pour la vente de PDF.
    isbn: z.string().trim().max(40, ISBN_ERROR_MESSAGE).optional(),
    rightsAccepted: z.literal("true", {
      errorMap: () => ({
        message: "Vous devez cocher cette case de certification pour publier.",
      }),
    }),
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
    if (data.kind === "BOOK_EDITION") {
      if (!data.publishingCapacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["publishingCapacity"],
          message: "Choisissez votre qualité : auteur, éditeur indépendant ou vendeur tiers.",
        });
      }

      if (!data.authorName || data.authorName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["authorName"],
          message: "Le nom de l'auteur doit contenir au moins 2 caractères.",
        });
      }

      if (data.isbn && data.isbn.length > 0 && normalizeIsbn(data.isbn) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["isbn"],
          message: ISBN_ERROR_MESSAGE,
        });
      }
    } else if (data.authorName && data.authorName.length === 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["authorName"],
        message: "Le nom de l'auteur doit contenir au moins 2 caractères (ou rester vide).",
      });
    }

    if (!Number.isFinite(data.price)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Prix invalide.",
      });
      return;
    }

    const min = MIN_PRICE.XOF;
    const max = MAX_PRICE.XOF;

    if (data.price < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: `Le prix minimum est de ${min} FCFA.`,
      });
    }

    if (data.price > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: `Le prix maximum est de ${max} FCFA.`,
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
  });

export type ProductFields = z.infer<typeof productFieldsSchema>;
