// src/app/api/admin/edition/[id]/epreuve/route.ts
// GET : téléchargement de l'épreuve déposée (administrateurs).
// POST : enregistrement d'une épreuve déjà envoyée dans le stockage privé (version suivante, passage au
//        stade « bon à tirer à valider », email à l'auteur).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { deletePrivateFile, inspectPrivatePdf, openPrivatePdfStream } from "@/lib/storage";
import { recordAdminAction } from "@/lib/audit";
import { isProofKeyFor } from "@/lib/edition-proof";
import { notifyAuthorProofReady } from "@/lib/edition-notify";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPEN_STAGES = ["IN_LAYOUT", "CHANGES_REQUESTED", "PROOF_PENDING"] as const;

function validId(id: string): boolean {
  return /^[a-z0-9]{1,40}$/i.test(id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return new Response("Accès refusé", { status: 403 });
  }

  const { id } = await params;
  if (!validId(id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId: id },
    select: { proofStorageKey: true, proofVersion: true },
  });

  if (!project || !project.proofStorageKey) {
    return new Response("Introuvable", { status: 404 });
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
      "Content-Disposition": `attachment; filename="epreuve-v${project.proofVersion}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
    return NextResponse.json({ error: "Ouvrage introuvable." }, { status: 404 });
  }

  let body: { key?: unknown; fileName?: unknown; size?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
  const declaredSize = typeof body.size === "number" ? body.size : 0;

  if (!isProofKeyFor(id, key) || fileName.length === 0) {
    return NextResponse.json({ error: "Fichier d'épreuve non autorisé." }, { status: 422 });
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId: id },
    select: {
      id: true,
      stage: true,
      proofVersion: true,
      proofStorageKey: true,
      signerEmail: true,
    },
  });

  if (!project || !(OPEN_STAGES as readonly string[]).includes(project.stage)) {
    return NextResponse.json({ error: "Cet ouvrage n'est pas en phase de mise en page." }, { status: 409 });
  }

  const fee = await prisma.publicationFee.findUnique({
    where: { productId: id },
    select: { status: true },
  });
  if (fee?.status !== "VALIDATED") {
    return NextResponse.json(
      { error: "Le forfait n'est pas validé : la mise en page ne peut pas commencer." },
      { status: 409 }
    );
  }

  const inspection = await inspectPrivatePdf(key);
  if (!inspection.exists) {
    return NextResponse.json(
      { error: "Fichier introuvable : l'envoi a échoué. Recommencez." },
      { status: 422 }
    );
  }
  if (!inspection.isPdf) {
    await deletePrivateFile(key).catch(() => undefined);
    return NextResponse.json({ error: "Ce fichier n'est pas un PDF valide." }, { status: 422 });
  }

  const size = inspection.sizeBytes ?? (declaredSize > 0 ? Math.floor(declaredSize) : 0);
  if (size <= 0 || size > MAX_PDF_SIZE_BYTES) {
    await deletePrivateFile(key).catch(() => undefined);
    return NextResponse.json({ error: "Taille du PDF invalide (50 Mo maximum)." }, { status: 422 });
  }

  const nextVersion = project.proofVersion + 1;

  const claimed = await prisma.editionProject.updateMany({
    where: {
      id: project.id,
      stage: { in: [...OPEN_STAGES] },
      proofVersion: project.proofVersion,
    },
    data: {
      stage: "PROOF_PENDING",
      proofStorageKey: key,
      proofFileName: fileName,
      proofSizeBytes: size,
      proofVersion: nextVersion,
      proofUploadedAt: new Date(),
      changeRequest: null,
    },
  });

  if (claimed.count === 0) {
    await deletePrivateFile(key).catch(() => undefined);
    return NextResponse.json(
      { error: "Une autre épreuve vient d'être enregistrée. Rechargez la page." },
      { status: 409 }
    );
  }

  // L'ancienne épreuve, jamais approuvée, n'a plus d'utilité.
  if (project.proofStorageKey && project.proofStorageKey !== key) {
    await deletePrivateFile(project.proofStorageKey).catch(() => undefined);
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { title: true },
  });
  const title = product?.title ?? "Votre livre";

  await recordAdminAction(admin, {
    action: "edition.epreuve_deposee",
    targetType: "produit",
    targetId: id,
    details: { titre: title, version: nextVersion },
  });

  await notifyAuthorProofReady({
    to: project.signerEmail,
    productId: id,
    title,
    version: nextVersion,
  });

  revalidatePath("/admin/editions");
  revalidatePath(`/vendeur/publication/${id}`);

  return NextResponse.json({ ok: true, version: nextVersion });
}
