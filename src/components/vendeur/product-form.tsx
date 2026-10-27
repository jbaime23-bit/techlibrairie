// src/lib/product-validation.ts
// Règles de validation d'un produit (utilisables côté navigateur et serveur).
// Règle métier : tous les prix sont fixés en FCFA (XOF), sans taxe.

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
=================================== /api/produits
// src/app/api/produits/route.ts
// Création d'un produit par un vendeur.
// Le produit est PUBLIÉ automatiquement dès sa soumission.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import { productFieldsSchema } from "@/lib/product-validation";
import {
  deletePrivateFile,
  deletePublicCover,
  inspectPrivatePdf,
  isOwnedPdfKey,
  uploadPublicCover,
} from "@/lib/storage";
import { slugWithSuffix, toStoredAmount } from "@/lib/utils";

type FieldErrors = Record<string, string[] | undefined>;

function readField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/]/g, "_").slice(0, 200);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function validationError(fieldErrors: FieldErrors, status: number = 422) {
  return NextResponse.json(
    { error: "Veuillez corriger les champs signalés.", fieldErrors },
    { status }
  );
}

export async function POST(request: Request) {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    return NextResponse.json(
      { error: "Accès refusé : un compte vendeur actif est requis." },
      { status: 403 }
    );
  }
  const { seller } = context;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = productFieldsSchema.safeParse({
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    categoryId: readField(formData, "categoryId"),
    currency: readField(formData, "currency"),
    price: readField(formData, "price"),
    language: readField(formData, "language"),
    pageCount: readField(formData, "pageCount"),
    pdfStorageKey: readField(formData, "pdfStorageKey"),
    pdfFileName: readField(formData, "pdfFileName"),
    pdfSizeBytes: readField(formData, "pdfSizeBytes"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors as FieldErrors;
    const fieldErrors: FieldErrors = { ...flat };
    const pdfErrors =
      flat.pdfStorageKey ?? flat.pdfFileName ?? flat.pdfSizeBytes;
    delete fieldErrors.pdfStorageKey;
    delete fieldErrors.pdfFileName;
    delete fieldErrors.pdfSizeBytes;
    if (pdfErrors) fieldErrors.pdf = pdfErrors;
    return validationError(fieldErrors);
  }

  const fields = parsed.data;

  // Le PDF doit appartenir à ce vendeur.
  if (!isOwnedPdfKey(fields.pdfStorageKey, seller.id)) {
    return validationError({ pdf: ["Fichier PDF non autorisé."] }, 403);
  }

  if (fields.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: fields.categoryId },
      select: { id: true },
    });
    if (!category) {
      return validationError({ categoryId: ["Catégorie introuvable."] });
    }
  }

  // Le PDF doit exister dans le store privé et être un vrai PDF.
  const inspection = await inspectPrivatePdf(fields.pdfStorageKey);
  if (!inspection.exists) {
    return validationError({
      pdf: ["Le fichier PDF est introuvable. Veuillez l'envoyer à nouveau."],
    });
  }
  if (!inspection.isPdf) {
    await deletePrivateFile(fields.pdfStorageKey).catch(() => undefined);
    return validationError({ pdf: ["Le fichier envoyé n'est pas un PDF valide."] });
  }

  // Couverture facultative (via le serveur, 2 Mo maximum).
  let coverImageUrl: string | null = null;
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    try {
      coverImageUrl = await uploadPublicCover(cover, seller.id);
    } catch (error) {
      return validationError({
        cover: [
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer la couverture.",
        ],
      });
    }
  }

  try {
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: fields.categoryId ?? null,
        title: fields.title,
        slug: slugWithSuffix(fields.title),
        description: fields.description,
        language: fields.language,
        pageCount: fields.pageCount ?? null,
        priceAmount: toStoredAmount(fields.price, fields.currency),
        currency: fields.currency,
        coverImageUrl,
        pdfStorageKey: fields.pdfStorageKey,
        pdfFileName: sanitizeFileName(fields.pdfFileName),
        pdfSizeBytes: inspection.sizeBytes ?? fields.pdfSizeBytes,
        // status : PUBLISHED par défaut => publication automatique
      },
      select: { id: true, slug: true },
    });

    revalidatePath("/vendeur");
    revalidatePath("/vendeur/produits");
    revalidatePath("/catalogue");

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du produit :", error);
    if (coverImageUrl) {
      await deletePublicCover(coverImageUrl).catch(() => undefined);
    }
    await deletePrivateFile(fields.pdfStorageKey).catch(() => undefined);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }
}
=================================== /api/upload/pdf
// src/app/api/upload/pdf/route.ts
// Génère les jetons d'envoi direct (navigateur -> Vercel Blob) pour les PDF.
// L'authentification se fait dans onBeforeGenerateToken.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSellerContext } from "@/lib/seller";
import { isOwnedPdfKey } from "@/lib/storage";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const context = await getSellerContext();

        if (context.status !== "ok") {
          throw new Error("Accès refusé : un compte vendeur actif est requis.");
        }

        if (!isOwnedPdfKey(pathname, context.seller.id)) {
          throw new Error("Chemin de fichier non autorisé.");
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Envoi refusé." },
      { status: 400 }
    );
  }
}
