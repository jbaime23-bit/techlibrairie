// src/app/api/admin/gratuit/route.ts
// Création d'une ressource gratuite (administrateurs) : le PDF a déjà été envoyé directement
// dans le stockage privé ; cette route vérifie le fichier, envoie la couverture et enregistre la fiche.

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import {
  deletePrivateFile,
  deletePublicCover,
  inspectPrivatePdf,
  uploadPublicCover,
} from "@/lib/storage";
import { isFreePdfKey } from "@/lib/free-resources";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";
import { recordAdminAction } from "@/lib/audit";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FieldErrors = Record<string, string[]>;

const LANGUAGES = ["fr", "en"];

function text(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function fail(fieldErrors: FieldErrors, status: number = 422) {
  return NextResponse.json(
    { error: "Veuillez corriger les champs signalés.", fieldErrors },
    { status }
  );
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 80) || "ressource";

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await prisma.freeResource.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json(
      { error: "Accès refusé : réservé aux administrateurs." },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const title = text(formData, "title", 120);
  const description = text(formData, "description", 3000);
  const language = text(formData, "language", 5);
  const pagesRaw = text(formData, "pages", 6);
  const pdfKey = text(formData, "pdfKey", 300);
  const pdfName = text(formData, "pdfName", 200);
  const pdfSizeRaw = Number.parseInt(text(formData, "pdfSize", 12), 10);
  const cover = formData.get("cover");

  // Un PDF déjà envoyé mais dont la fiche est refusée est supprimé : le formulaire le renvoie à chaque essai.
  const discardPdf = async () => {
    if (isFreePdfKey(pdfKey)) {
      await deletePrivateFile(pdfKey).catch(() => undefined);
    }
  };

  const errors: FieldErrors = {};

  if (title.length < 3) errors.title = ["Le titre doit contenir au moins 3 caractères."];
  if (description.length < 10) {
    errors.description = ["La description doit contenir au moins 10 caractères."];
  }
  if (!LANGUAGES.includes(language)) errors.language = ["Choisissez une langue."];

  let pageCount: number | null = null;
  if (pagesRaw !== "") {
    const parsed = Number.parseInt(pagesRaw, 10);
    if (!/^\d+$/.test(pagesRaw) || parsed < 1 || parsed > 10000) {
      errors.pages = ["Nombre de pages invalide (de 1 à 10 000)."];
    } else {
      pageCount = parsed;
    }
  }

  if (!isFreePdfKey(pdfKey)) {
    errors.pdf = ["Le fichier PDF n'a pas été envoyé correctement. Recommencez."];
  }

  if (Object.keys(errors).length > 0) {
    await discardPdf();
    return fail(errors);
  }

  const inspection = await inspectPrivatePdf(pdfKey);
  if (!inspection.exists) {
    return fail({ pdf: ["Fichier introuvable : l'envoi a échoué. Recommencez."] });
  }
  if (!inspection.isPdf) {
    await discardPdf();
    return fail({ pdf: ["Ce fichier n'est pas un PDF valide."] });
  }

  const sizeBytes =
    inspection.sizeBytes ?? (Number.isFinite(pdfSizeRaw) && pdfSizeRaw > 0 ? pdfSizeRaw : null);

  if (sizeBytes === null || sizeBytes > MAX_PDF_SIZE_BYTES) {
    await discardPdf();
    return fail({ pdf: ["Taille du PDF invalide (50 Mo maximum)."] });
  }

  let coverUrl: string | null = null;
  if (cover instanceof File && cover.size > 0) {
    try {
      coverUrl = await uploadPublicCover(cover, "gratuit");
    } catch (error) {
      await discardPdf();
      return fail({
        cover: [error instanceof Error ? error.message : "Impossible d'envoyer la couverture."],
      });
    }
  }

  try {
    const slug = await uniqueSlug(title);

    const created = await prisma.freeResource.create({
      data: {
        title,
        slug,
        description,
        language,
        pageCount,
        coverImageUrl: coverUrl,
        pdfStorageKey: pdfKey,
        pdfFileName: pdfName || `${slug}.pdf`,
        pdfSizeBytes: sizeBytes,
      },
      select: { id: true },
    });

    await recordAdminAction(admin, {
      action: "gratuit.cree",
      targetType: "ressource",
      targetId: created.id,
      details: { titre: title },
    });
  } catch (error) {
    console.error("Création de la ressource gratuite impossible :", error);
    await discardPdf();
    if (coverUrl) {
      await deletePublicCover(coverUrl).catch(() => undefined);
    }
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  revalidatePath("/gratuit");
  revalidatePath("/admin/gratuit");

  return NextResponse.json({ ok: true }, { status: 201 });
}
