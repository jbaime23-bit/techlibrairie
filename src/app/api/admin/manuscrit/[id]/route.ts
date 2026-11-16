// src/app/api/admin/manuscrit/[id]/route.ts
// Téléchargement, par un administrateur, d'un manuscrit soumis à l'examen éditorial.
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

  const submission = await prisma.manuscriptSubmission.findUnique({
    where: { id },
    select: { manuscriptStorageKey: true, manuscriptFileName: true, title: true },
  });

  if (!submission) {
    return new Response("Introuvable", { status: 404 });
  }

  let stream: ReadableStream<Uint8Array> | null = null;
  try {
    stream = await openPrivatePdfStream(submission.manuscriptStorageKey);
  } catch (error) {
    console.error("Lecture du manuscrit impossible :", error);
  }

  if (!stream) {
    return new Response("Fichier introuvable", { status: 404 });
  }

  await recordAdminAction(admin, {
    action: "manuscrit.telecharge",
    targetType: "manuscrit",
    targetId: id,
    details: { titre: submission.title },
  });

  const safeName =
    submission.manuscriptFileName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.pdf$/i, "") || "manuscrit";

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
