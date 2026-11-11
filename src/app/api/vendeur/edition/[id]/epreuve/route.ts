// src/app/api/vendeur/edition/[id]/epreuve/route.ts
// Téléchargement, par son auteur, de l'épreuve de son livre (bon à tirer).
// Seul l'auteur propriétaire du projet peut la télécharger.

import { getSellerContext } from "@/lib/seller";
import { prisma } from "@/lib/prisma";
import { openPrivatePdfStream } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    return new Response("Accès refusé", { status: 403 });
  }

  const { id } = await params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const project = await prisma.editionProject.findFirst({
    where: { productId: id, sellerId: context.seller.id },
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
