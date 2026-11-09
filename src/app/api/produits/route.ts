// src/app/api/produits/route.ts
// Création d'un produit par un vendeur, selon le service choisi :
// - Vente de PDF (PDF_DOCUMENT) : publication immédiate.
// - Édition de livres à compte d'auteur (BOOK_EDITION) : contrat accepté au dépôt (texte archivé), forfait
//   à régler aussitôt après le dépôt ; l'ouvrage n'est publié qu'après maquette et bon à tirer.
//   Les ouvrages d'un administrateur sont publiés directement, sans contrat ni forfait.

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
import {
  CONTRACT_VERSION,
  RIGHTS_WARRANTY_TEXT,
  buildContract,
  contractToPlainText,
  hashText,
} from "@/lib/edition-contract";
import { getContributionConfig } from "@/lib/publication-fee";
import { hashClientIp } from "@/lib/login-throttle";
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

  // Édition à compte d'auteur : contrat et forfait, sauf pour un administrateur.
  const user = await getCurrentUser();
  const requiresContract = isEdition && user?.role !== "ADMIN";
  let signerName = "";

  if (requiresContract) {
    const contractErrors: FieldErrors = {};

    if (readField(formData, "contractAccepted") !== "true") {
      contractErrors.contractAccepted = ["Vous devez accepter le contrat pour déposer votre livre."];
    }
    if (readField(formData, "serviceStartRequested") !== "true") {
      contractErrors.serviceStartRequested = [
        "Cette demande est nécessaire pour que la prestation puisse commencer.",
      ];
    }

    signerName = readField(formData, "signerName") ?? "";
    if (signerName.length < 3 || signerName.length > 120) {
      contractErrors.signerName = [
        "Tapez votre nom et prénom (3 à 120 caractères) : il vaut signature du contrat.",
      ];
    }

    if (Object.keys(contractErrors).length > 0) {
      return validationError(contractErrors);
    }
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

  const pdfFileName = sanitizeFileName(fields.pdfFileName);

  // Texte du contrat tel qu'il est archivé : celui de la version courante, calculé côté serveur.
  const contractText = requiresContract ? contractToPlainText(buildContract()) : "";

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
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
          pdfFileName,
          pdfSizeBytes: inspection.sizeBytes ?? fields.pdfSizeBytes,
          isbn,
          publishingCapacity: isEdition ? fields.publishingCapacity ?? null : null,
          authorName: fields.authorName && fields.authorName.length > 0 ? fields.authorName : null,
          // Preuve de la déclaration de titularité : date du serveur et texte exact accepté.
          rightsCertifiedAt: new Date(),
          rightsCertificationText: isEdition
            ? RIGHTS_WARRANTY_TEXT
            : certificationTextFor(fields.kind),
          status: requiresContract ? "PENDING_PAYMENT" : "PUBLISHED",
          ...(requiresContract
            ? {
                publicationFee: {
                  create: { amountXof: getContributionConfig().amountXof },
                },
              }
            : {}),
        },
        select: { id: true, slug: true },
      });

      if (requiresContract) {
        await tx.editionProject.create({
          data: {
            productId: created.id,
            sellerId: seller.id,
            stage: "FEE_PENDING",
            contractVersion: CONTRACT_VERSION,
            contractHash: hashText(contractText),
            contractText,
            contractAcceptedAt: new Date(),
            signerName,
            signerEmail: user?.email ?? "",
            signerIpHash: hashClientIp(request.headers.get("x-forwarded-for")),
            serviceStartRequested: true,
            manuscriptStorageKey: fields.pdfStorageKey,
            manuscriptFileName: pdfFileName,
          },
        });
      }

      return created;
    });

    revalidatePath("/vendeur");
    revalidatePath("/vendeur/produits");
    revalidatePath("/catalogue");

    return NextResponse.json(
      { id: product.id, slug: product.slug, pendingPayment: requiresContract },
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
