// src/app/api/admin/impression/[id]/fichier/route.ts
// Enregistre un PDF d'impression (intérieur ou couverture) déjà envoyé dans le stockage privé.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { isLuluFileKey } from "@/lib/lulu-files";
import { resolvePrintStatus } from "@/lib/print-pricing";
import { deletePrivateFile, inspectPrivatePdf } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Role = "interieur" | "couverture";

function isRole(value: unknown): value is Role {
  return value === "interieur" || value === "couverture";
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
  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    return NextResponse.json({ error: "Livre introuvable." }, { status: 404 });
  }

  let body: { role?: unknown; pdfKey?: unknown; fileName?: unknown };
  try {
    body = (await request.json()) as { role?: unknown; pdfKey?: unknown; fileName?: unknown };
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const role = body.role;
  const pdfKey = typeof body.pdfKey === "string" ? body.pdfKey : "";
  const rawName = typeof body.fileName === "string" ? body.fileName : "fichier.pdf";
  const fileName = rawName.replace(/[\\/]/g, "_").slice(0, 200);

  if (!isRole(role) || !isLuluFileKey(pdfKey) || !pdfKey.startsWith(`lulu/${id}/${role}`)) {
    return NextResponse.json({ error: "Fichier d'impression non autorisé." }, { status: 403 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { kind: true, title: true },
  });

  if (!product || product.kind !== "BOOK_EDITION") {
    await deletePrivateFile(pdfKey).catch(() => undefined);
    return NextResponse.json({ error: "Ce produit n'est pas un livre de l'édition." }, { status: 409 });
  }

  const inspection = await inspectPrivatePdf(pdfKey);
  if (!inspection.exists) {
    return NextResponse.json({ error: "Fichier introuvable : l'envoi a échoué." }, { status: 422 });
  }
  if (!inspection.isPdf) {
    await deletePrivateFile(pdfKey).catch(() => undefined);
    return NextResponse.json({ error: "Ce fichier n'est pas un PDF valide." }, { status: 422 });
  }

  const existing = await prisma.printEdition.findUnique({ where: { productId: id } });
  const previousKey = role === "interieur" ? existing?.interiorStorageKey : existing?.coverStorageKey;

  const data =
    role === "interieur"
      ? { interiorStorageKey: pdfKey, interiorFileName: fileName }
      : { coverStorageKey: pdfKey, coverFileName: fileName };

  const saved = await prisma.printEdition.upsert({
    where: { productId: id },
    create: { productId: id, ...data },
    update: data,
  });

  const nextStatus = resolvePrintStatus(saved);
  if (nextStatus !== saved.status) {
    await prisma.printEdition.update({ where: { productId: id }, data: { status: nextStatus } });
  }

  // L'ancien fichier est remplacé : on le supprime une fois la base à jour.
  if (previousKey && previousKey !== pdfKey) {
    await deletePrivateFile(previousKey).catch(() => undefined);
  }

  await recordAdminAction(admin, {
    action: "impression.fichier_depose",
    targetType: "produit",
    targetId: id,
    details: { titre: product.title, fichier: role },
  });

  revalidatePath("/admin/impression");
  revalidatePath(`/vendeur/impression/${id}`);

  return NextResponse.json({ ok: true });
      }
