// src/app/api/admin/produit/[id]/fichier/route.ts
// Téléchargement, par un administrateur, du PDF d'un ouvrage en attente de validation.
// Chaque téléchargement est enregistré dans le journal.

import { getAdminOrNull } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { openPrivatePdfStream } from "@/lib/storage";
import { recordAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return new Response("Accès refusé", { status: 403 });
  }

  const { id } = await params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { pdfStorageKey: true, pdfFileName: true, title: true },
  });

  if (!product) {
    return new Response("Introuvable", { status: 404 });
  }

  let stream: ReadableStream<Uint8Array> | null = null;
  try {
    stream = await openPrivatePdfStream(product.pdfStorageKey);
  } catch (error) {
    console.error("Lecture du PDF de l'ouvrage impossible :", error);
  }

  if (!stream) {
    return new Response("Fichier introuvable", { status: 404 });
  }

  await recordAdminAction(admin, {
    action: "produit.fichier_telecharge",
    targetType: "produit",
    targetId: id,
    details: { titre: product.title },
  });

  const safeName =
    product.pdfFileName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.pdf$/i, "") || "ouvrage";

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
    }
