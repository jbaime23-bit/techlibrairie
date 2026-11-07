// src/app/api/produits/route.ts
// Création d'un produit par un vendeur, selon le service choisi :
// - Vente de PDF (PDF_DOCUMENT) : publication immédiate.
// - Édition de livres (BOOK_EDITION) : qualité, auteur, ISBN contrôlé ; l'ouvrage est publié après la
//   validation de la contribution de participation (sauf pour un administrateur).
// La certification des droits est vérifiée ici, côté serveur.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContext } from "@/lib/seller";
import {
  ISBN_ERROR_MESSAGE,
  certificationTextFor,
  normalizeIsbn,
  productFieldsSchema,
} from "@/lib/product-validation";
import { getContributionConfig } from "@/lib/publication-fee";
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
    kind: readField(formData, "kind"),
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    categoryId: readField(formData, "categoryId"),
    currency: readField(formData, "currency"),
    price: readField(formData, "price"),
    language: readField(formData, "language"),
    pageCount: readField(formData, "pageCount"),
    publishingCapacity: readField(formData, "publishingCapacity"),
    authorName: readField(formData, "authorName"),
    isbn: readField(formData, "isbn"),
    rightsAccepted: readField(formData, "rightsAccepted"),
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
  const isEdition = fields.kind === "BOOK_EDITION";

  // Le PDF doit appartenir à ce vendeur.
  if (!isOwnedPdfKey(fields.pdfStorageKey, seller.id)) {
    return validationError({ pdf: ["Fichier PDF non autorisé."] }, 403);
  }

  // ISBN (édition de livres seulement) : normalisé, sans tirets, et unique dans le catalogue.
  let isbn: string | null = null;
  if (isEdition && fields.isbn) {
    isbn = normalizeIsbn(fields.isbn);
    if (!isbn) {
      return validationError({ isbn: [ISBN_ERROR_MESSAGE] });
    }

    const duplicate = await prisma.product.findFirst({
      where: { isbn },
      select: { id: true },
    });
    if (duplicate) {
      return validationError({
        isbn: [
          "Cet ISBN est déjà utilisé par un autre ouvrage du catalogue. Si c'est une erreur, contactez-nous.",
        ],
      });
    }
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

  // Contribution de participation : édition de livres seulement, et jamais pour un administrateur.
  const user = await getCurrentUser();
  const requiresContribution = isEdition && user?.role !== "ADMIN";

  try {
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: fields.categoryId ?? null,
        kind: fields.kind,
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
        isbn,
        publishingCapacity: isEdition ? fields.publishingCapacity ?? null : null,
        authorName: fields.authorName && fields.authorName.length > 0 ? fields.authorName : null,
        // Preuve de la certification : date du serveur et texte exact accepté pour ce service.
        rightsCertifiedAt: new Date(),
        rightsCertificationText: certificationTextFor(fields.kind),
        status: requiresContribution ? "PENDING_PAYMENT" : "PUBLISHED",
        ...(requiresContribution
          ? {
              publicationFee: {
                create: { amountXof: getContributionConfig().amountXof },
              },
            }
          : {}),
      },
      select: { id: true, slug: true },
    });

    revalidatePath("/vendeur");
    revalidatePath("/vendeur/produits");
    revalidatePath("/catalogue");

    return NextResponse.json(
      { id: product.id, slug: product.slug, pendingPayment: requiresContribution },
      { status: 201 }
    );
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
