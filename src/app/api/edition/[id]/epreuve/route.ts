// src/app/api/edition/[id]/epreuve/route.ts
// - POST (administrateur) : enregistre une épreuve (bon à tirer) déjà envoyée dans le stockage privé.
// - GET (administrateur ou auteur concerné) : affiche l'épreuve courante.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { getSellerContext } from "@/lib/seller";
import { recordAdminAction } from "@/lib/audit";
import { isEditionProofKey } from "@/lib/edition-files";
import { notifyAuthorProofReady } from "@/lib/edition-notifications";
import {
  deletePrivateFile,
  inspectPrivatePdf,
  openPrivatePdfStream,
} from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPEN_STAGES = ["IN_LAYOUT", "CHANGES_REQUESTED", "PROOF_PENDING"];

function validId(id: string): boolean {
  return /^[a-z0-9]{1,40}$/i.test(id);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé : réservé aux administrateurs." }, { status: 403 });
  }

  const { id } = await params;
  if (!validId(id)) {
    return NextResponse.json({ error: "Édition introuvable." }, { status: 404 });
  }

  let body: { pdfKey?: unknown; fileName?: unknown };
  try {
    body = (await request.json()) as { pdfKey?: unknown; fileName?: unknown };
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const pdfKey = typeof body.pdfKey === "string" ? body.pdfKey : "";
  const fileName =
    typeof body.fileName === "string" ? body.fileName.replace(/[\\/]/g, "_").slice(0, 200) : "epreuve.pdf";

  if (!isEditionProofKey(pdfKey, id)) {
    return NextResponse.json({ error: "Fichier d'épreuve non autorisé." }, { status: 403 });
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId: id },
    select: { id: true, stage: true, proofStorageKey: true, product: { select: { title: true } } },
  });

  const productInfo = await prisma.product.findUnique({
    where: { id },
    select: { title: true },
  });

  if (!project || !OPEN_STAGES.includes(project.stage)) {
    await deletePrivateFile(pdfKey).catch(() => undefined);
    return NextResponse.json(
      { error: "Cette édition n'est pas en cours de mise en page." },
      { status: 409 }
    );
  }

  const inspection = await inspectPrivatePdf(pdfKey);
  if (!inspection.exists) {
    return NextResponse.json({ error: "Fichier introuvable : l'envoi a échoué." }, { status: 422 });
  }
  if (!inspection.isPdf) {
    await deletePrivateFile(pdfKey).catch(() => undefined);
    return NextResponse.json({ error: "Ce fichier n'est pas un PDF valide." }, { status: 422 });
  }

  const previousKey = project.proofStorageKey;

  const updated = await prisma.editionProject.update({
    where: { id: project.id },
    data: {
      proofStorageKey: pdfKey,
      proofFileName: fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`,
      proofSizeBytes: inspection.sizeBytes ?? null,
      proofVersion: { increment: 1 },
      proofUploadedAt: new Date(),
      stage: "PROOF_PENDING",
      changeRequest: null,
    },
    select: { proofVersion: true },
  });

  // L'ancienne épreuve est remplacée : on la supprime une fois la base à jour.
  if (previousKey && previousKey !== pdfKey) {
    await deletePrivateFile(previousKey).catch(() => undefined);
  }

  await recordAdminAction(admin, {
    action: "edition.epreuve_deposee",
    targetType: "produit",
    targetId: id,
    details: { titre: productInfo?.title ?? project.product.title, version: updated.proofVersion },
  });

  await notifyAuthorProofReady(id, updated.proofVersion);

  revalidatePath("/admin/publications");
  revalidatePath(`/vendeur/publication/${id}`);
  revalidatePath("/vendeur/produits");

  return NextResponse.json({ ok: true, version: updated.proofVersion });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validId(id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId: id },
    select: { sellerId: true, proofStorageKey: true, proofVersion: true },
  });

  if (!project || !project.proofStorageKey) {
    return new Response("Introuvable", { status: 404 });
  }

  let allowed = Boolean(await getAdminOrNull());

  if (!allowed) {
    const context = await getSellerContext();
    allowed = context.status === "ok" && context.seller.id === project.sellerId;
  }

  if (!allowed) {
    return new Response("Accès refusé", { status: 403 });
  }

  let stream: ReadableStream<Uint8Array> | null = null;
  try {
    stream = await openPrivatePdfStream(project.proofStorageKey);
  } catch (error) {
    console.error("Lecture de l'épreuve impossible :", error);
  }

  if (!stream) {
    return new Response("Fichier introuvable", { status: 404 });
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="epreuve-v${project.proofVersion}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
