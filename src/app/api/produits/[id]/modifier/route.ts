// src/app/api/produits/[id]/modifier/route.ts
// Modification d'un produit par son vendeur (publiée immédiatement).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import { productEditSchema } from "@/lib/product-edit-validation";
import {
  deletePrivateFile,
  deletePublicCover,
  inspectPrivatePdf,
  isOwnedPdfKey,
  uploadPublicCover,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const context = await getSellerContext();
  if (context.status !== "ok") {
    return NextResponse.json(
      { error: "Accès refusé : un compte vendeur actif est requis." },
      { status: 403 }
    );
  }
  const { seller } = context;

  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const product = await prisma.product.findFirst({
    where: { id, sellerId: seller.id },
  });

  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = productEditSchema.safeParse({
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    categoryId: readField(formData, "categoryId"),
    language: readField(formData, "language"),
    pageCount: readField(formData, "pageCount"),
    price: readField(formData, "price"),
    removeCover: readField(formData, "removeCover"),
    newPdfStorageKey: readField(formData, "newPdfStorageKey"),
    newPdfFileName: readField(formData, "newPdfFileName"),
    newPdfSizeBytes: readField(formData, "newPdfSizeBytes"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors as FieldErrors;
    const fieldErrors: FieldErrors = { ...flat };
    const pdfErrors =
      flat.newPdfStorageKey ?? flat.newPdfFileName ?? flat.newPdfSizeBytes;
    delete fieldErrors.newPdfStorageKey;
    delete fieldErrors.newPdfFileName;
    delete fieldErrors.newPdfSizeBytes;
    if (pdfErrors) fieldErrors.pdf = pdfErrors;
    return validationError(fieldErrors);
  }

  const fields = parsed.data;

  if (fields.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: fields.categoryId },
      select: { id: true },
    });
    if (!category) {
      return validationError({ categoryId: ["Catégorie introuvable."] });
    }
  }

  // Remplacement du PDF (le nouveau fichier doit appartenir au vendeur et être un vrai PDF).
  let newPdf: { key: string; name: string; size: number } | null = null;

  if (fields.newPdfStorageKey && fields.newPdfStorageKey !== product.pdfStorageKey) {
    if (!isOwnedPdfKey(fields.newPdfStorageKey, seller.id)) {
      return validationError({ pdf: ["Fichier PDF non autorisé."] }, 403);
    }

    const inspection = await inspectPrivatePdf(fields.newPdfStorageKey);
    if (!inspection.exists) {
      return validationError({
        pdf: ["Le fichier PDF est introuvable. Veuillez l'envoyer à nouveau."],
      });
    }
    if (!inspection.isPdf) {
      await deletePrivateFile(fields.newPdfStorageKey).catch(() => undefined);
      return validationError({ pdf: ["Le fichier envoyé n'est pas un PDF valide."] });
    }

    newPdf = {
      key: fields.newPdfStorageKey,
      name: sanitizeFileName(fields.newPdfFileName ?? "document.pdf"),
      size: inspection.sizeBytes ?? fields.newPdfSizeBytes ?? product.pdfSizeBytes,
    };
  }

  // Couverture : une nouvelle image remplace l'ancienne ; sinon la case "supprimer" l'enlève.
  let nextCoverUrl = product.coverImageUrl;
  let uploadedCover: string | null = null;
  let coverToDelete: string | null = null;

  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    try {
      uploadedCover = await uploadPublicCover(cover, seller.id);
    } catch (error) {
      return validationError({
        cover: [
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer la couverture.",
        ],
      });
    }
    nextCoverUrl = uploadedCover;
    coverToDelete = product.coverImageUrl;
  } else if (fields.removeCover === "true" && product.coverImageUrl) {
    nextCoverUrl = null;
    coverToDelete = product.coverImageUrl;
  }

  // Le prix n'est modifiable que pour un produit en FCFA.
  const priceAmount =
    product.currency === "XOF" && fields.price !== undefined
      ? Math.round(fields.price)
      : product.priceAmount;

  try {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        title: fields.title,
        description: fields.description,
        categoryId: fields.categoryId ?? null,
        language: fields.language,
        pageCount: fields.pageCount ?? null,
        priceAmount,
        coverImageUrl: nextCoverUrl,
        ...(newPdf
          ? {
              pdfStorageKey: newPdf.key,
              pdfFileName: newPdf.name,
              pdfSizeBytes: newPdf.size,
            }
          : {}),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la modification du produit :", error);
    if (uploadedCover) {
      await deletePublicCover(uploadedCover).catch(() => undefined);
    }
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  // Nettoyage des anciens fichiers, une fois la base mise à jour.
  if (coverToDelete) {
    await deletePublicCover(coverToDelete).catch(() => undefined);
  }
  if (newPdf) {
    await deletePrivateFile(product.pdfStorageKey).catch(() => undefined);
  }

  revalidatePath("/vendeur");
  revalidatePath("/vendeur/produits");
  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${product.slug}`);

  return NextResponse.json({ ok: true });
  }
