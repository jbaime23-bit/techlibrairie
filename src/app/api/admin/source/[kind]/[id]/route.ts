// src/app/api/admin/source/[kind]/[id]/route.ts
// Version Word d'un dossier (kind = « projet » pour un livre à compte d'auteur, « manuscrit » pour un manuscrit
// soumis ; id = identifiant correspondant). Administrateurs seulement.
// - GET : télécharge le fichier Word.
// - POST : joint (ou remplace) la version Word d'un dossier, après un envoi direct vers sources/admin/.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { DOCX_CONTENT_TYPE } from "@/lib/source-constants";
import { isAdminSourceKey, looksLikeDocx, sanitizeDocxName } from "@/lib/source-files";
import { deletePrivateFile, inspectPrivatePdf, openPrivatePdfStream } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Kind = "projet" | "manuscrit";

function parseParams(kind: string, id: string): { kind: Kind; id: string } | null {
  if ((kind !== "projet" && kind !== "manuscrit") || !/^[a-z0-9]{1,40}$/i.test(id)) return null;
  return { kind, id };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return new Response("Accès refusé", { status: 403 });
  }

  const raw = await params;
  const parsed = parseParams(raw.kind, raw.id);
  if (!parsed) {
    return new Response("Introuvable", { status: 404 });
  }

  const source = await prisma.manuscriptSource.findUnique({
    where: parsed.kind === "projet" ? { productId: parsed.id } : { submissionId: parsed.id },
    select: { storageKey: true, fileName: true },
  });

  if (!source) {
    return new Response("Introuvable", { status: 404 });
  }

  let stream: ReadableStream<Uint8Array> | null = null;
  try {
    stream = await openPrivatePdfStream(source.storageKey);
  } catch (error) {
    console.error("Lecture de la version Word impossible :", error);
  }

  if (!stream) {
    return new Response("Fichier introuvable", { status: 404 });
  }

  await recordAdminAction(admin, {
    action: "edition.manuscrit_telecharge",
    targetType: parsed.kind === "projet" ? "produit" : "manuscrit",
    targetId: parsed.id,
    details: { fichier: "version Word" },
  });

  const safeName = source.fileName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.docx$/i, "") || "manuscrit";

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": DOCX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${safeName}.docx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé : réservé aux administrateurs." }, { status: 403 });
  }

  const raw = await params;
  const parsed = parseParams(raw.kind, raw.id);
  if (!parsed) {
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  }

  let body: { storageKey?: unknown; fileName?: unknown };
  try {
    body = (await request.json()) as { storageKey?: unknown; fileName?: unknown };
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const storageKey = typeof body.storageKey === "string" ? body.storageKey : "";
  const fileName = sanitizeDocxName(typeof body.fileName === "string" ? body.fileName : "manuscrit.docx");

  if (!isAdminSourceKey(storageKey) || !storageKey.startsWith(`sources/admin/${parsed.kind}-${parsed.id}/`)) {
    return NextResponse.json({ error: "Fichier non autorisé pour ce dossier." }, { status: 403 });
  }

  // Le dossier doit exister, et appartient à un auteur.
  let sellerId: string | null = null;

  if (parsed.kind === "projet") {
    const product = await prisma.product.findUnique({
      where: { id: parsed.id },
      select: { sellerId: true, kind: true },
    });
    sellerId = product && product.kind === "BOOK_EDITION" ? product.sellerId : null;
  } else {
    const submission = await prisma.manuscriptSubmission.findUnique({
      where: { id: parsed.id },
      select: { sellerId: true },
    });
    sellerId = submission?.sellerId ?? null;
  }

  if (!sellerId) {
    await deletePrivateFile(storageKey).catch(() => undefined);
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  }

  const inspection = await inspectPrivatePdf(storageKey);
  if (!inspection.exists || !(await looksLikeDocx(storageKey))) {
    await deletePrivateFile(storageKey).catch(() => undefined);
    return NextResponse.json(
      { error: "Ce fichier n'est pas un document Word (.docx) valide." },
      { status: 422 }
    );
  }

  const sizeBytes = inspection.sizeBytes ?? 0;

  const existing = await prisma.manuscriptSource.findUnique({
    where: parsed.kind === "projet" ? { productId: parsed.id } : { submissionId: parsed.id },
    select: { storageKey: true },
  });

  const link = parsed.kind === "projet" ? { productId: parsed.id } : { submissionId: parsed.id };

  await prisma.manuscriptSource.upsert({
    where: parsed.kind === "projet" ? { productId: parsed.id } : { submissionId: parsed.id },
    create: { sellerId, ...link, storageKey, fileName, sizeBytes, addedBy: "ADMIN" },
    update: { storageKey, fileName, sizeBytes, addedBy: "ADMIN" },
  });

  if (existing && existing.storageKey !== storageKey) {
    await deletePrivateFile(existing.storageKey).catch(() => undefined);
  }

  await recordAdminAction(admin, {
    action: "source.jointe",
    targetType: parsed.kind === "projet" ? "produit" : "manuscrit",
    targetId: parsed.id,
    details: { fichier: fileName },
  });

  revalidatePath("/admin/assemblage");

  return NextResponse.json({ ok: true });
  }
