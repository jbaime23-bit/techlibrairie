// src/app/api/admin/edition/[id]/manuscrit/route.ts
// Téléchargement, par un administrateur, du manuscrit déposé par un auteur (pour la mise en page).
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

  const project = await prisma.editionProject.findUnique({
    where: { productId: id },
    select: { manuscriptStorageKey: true, manuscriptFileName: true },
  });

  if (!project) {
    return new Response("Introuvable", { status: 404 });
  }

  let stream: ReadableStream<Uint8Array> | null = null;
  try {
    stream = await openPrivatePdfStream(project.manuscriptStorageKey);
  } catch (error) {
    console.error("Lecture du manuscrit impossible :", error);
  }

  if (!stream) {
    return new Response("Fichier introuvable", { status: 404 });
  }

  await recordAdminAction(admin, {
    action: "edition.manuscrit_telecharge",
    targetType: "produit",
    targetId: id,
  });

  const safeName =
    project.manuscriptFileName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.pdf$/i, "") || "manuscrit";

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="manuscrit-${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
      }
