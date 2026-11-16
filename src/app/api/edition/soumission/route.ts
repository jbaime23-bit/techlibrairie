// src/app/api/edition/soumission/route.ts
// Soumission d'un manuscrit à l'examen éditorial (formule à compte d'éditeur) : aucun paiement ni contrat à
// la soumission. Les déclarations (droits, examen) sont vérifiées ici, côté serveur.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContext } from "@/lib/seller";
import { RIGHTS_WARRANTY_TEXT } from "@/lib/edition-contract";
import {
  MAX_SUBMISSIONS_PER_DAY,
  isOwnedManuscriptKey,
  manuscriptFieldsSchema,
} from "@/lib/manuscript-validation";
import { notifyAdminsManuscriptSubmitted } from "@/lib/manuscript-notifications";
import {
  deletePrivateFile,
  deletePublicCover,
  inspectPrivatePdf,
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

export async function POST(request: Request) {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    return NextResponse.json(
      { error: "Accès refusé : un espace auteur actif est requis." },
      { status: 403 }
    );
  }
  const { seller } = context;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = manuscriptFieldsSchema.safeParse({
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    categoryId: readField(formData, "categoryId"),
    language: readField(formData, "language"),
    pageCount: readField(formData, "pageCount"),
    authorName: readField(formData, "authorName"),
    capacity: readField(formData, "capacity"),
    rightsAccepted: readField(formData, "rightsAccepted"),
    reviewConsent: readField(formData, "reviewConsent"),
    pdfStorageKey: readField(formData, "pdfStorageKey"),
    pdfFileName: readField(formData, "pdfFileName"),
    pdfSizeBytes: readField(formData, "pdfSizeBytes"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors as FieldErrors;
    const fieldErrors: FieldErrors = { ...flat };
    const pdfErrors = flat.pdfStorageKey ?? flat.pdfFileName ?? flat.pdfSizeBytes;
    delete fieldErrors.pdfStorageKey;
    delete fieldErrors.pdfFileName;
    delete fieldErrors.pdfSizeBytes;
    if (pdfErrors) fieldErrors.pdf = pdfErrors;
    return validationError(fieldErrors);
  }

  const fields = parsed.data;

  // Le manuscrit doit appartenir à cet auteur.
  if (!isOwnedManuscriptKey(fields.pdfStorageKey, seller.id)) {
    return validationError({ pdf: ["Fichier de manuscrit non autorisé."] }, 403);
  }

  // Limite quotidienne : évite les envois en rafale.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.manuscriptSubmission.count({
    where: { sellerId: seller.id, createdAt: { gte: since } },
  });
  if (recent >= MAX_SUBMISSIONS_PER_DAY) {
    return NextResponse.json(
      { error: `Vous avez déjà soumis ${MAX_SUBMISSIONS_PER_DAY} manuscrits aujourd'hui. Réessayez demain.` },
      { status: 429 }
    );
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

  // Le manuscrit doit exister dans le stockage privé et être un vrai PDF.
  const inspection = await inspectPrivatePdf(fields.pdfStorageKey);
  if (!inspection.exists) {
    return validationError({
      pdf: ["Le manuscrit est introuvable. Veuillez l'envoyer à nouveau."],
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
        cover: [error instanceof Error ? error.message : "Impossible d'envoyer la couverture."],
      });
    }
  }

  const now = new Date();

  try {
    const submission = await prisma.manuscriptSubmission.create({
      data: {
        sellerId: seller.id,
        userId: user.id,
        title: fields.title,
        description: fields.description,
        language: fields.language,
        pageCount: fields.pageCount ?? null,
        categoryId: fields.categoryId ?? null,
        authorName: fields.authorName,
        capacity: fields.capacity,
        manuscriptStorageKey: fields.pdfStorageKey,
        manuscriptFileName: sanitizeFileName(fields.pdfFileName),
        manuscriptSizeBytes: inspection.sizeBytes ?? fields.pdfSizeBytes,
        coverImageUrl,
        // Preuves des déclarations : date du serveur et texte exact accepté.
        rightsAcceptedAt: now,
        rightsText: RIGHTS_WARRANTY_TEXT,
        reviewConsentAt: now,
      },
      select: { id: true },
    });

    await notifyAdminsManuscriptSubmitted(submission.id);

    revalidatePath("/edition/espace");
    revalidatePath("/admin/manuscrits");

    return NextResponse.json({ id: submission.id }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la soumission du manuscrit :", error);
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
