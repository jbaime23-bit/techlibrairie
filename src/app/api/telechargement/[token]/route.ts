// src/app/api/telechargement/[token]/route.ts
// Téléchargement sécurisé d'un PDF acheté.
// Conditions : acheteur connecté, commande payée, lien non expiré,
// nombre de téléchargements non épuisé.

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { openPrivatePdfStream } from "@/lib/storage";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Veuillez vous connecter pour télécharger votre achat.", 401);
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return jsonError("Lien de téléchargement introuvable.", 404);
  }

  const record = await prisma.downloadToken.findUnique({
    where: { token },
    include: {
      orderItem: {
        include: {
          order: { select: { buyerId: true, status: true } },
          product: { select: { pdfStorageKey: true, pdfFileName: true } },
        },
      },
    },
  });

  if (
    !record ||
    record.orderItem.order.buyerId !== user.id ||
    record.orderItem.order.status !== "PAID"
  ) {
    return jsonError("Lien de téléchargement introuvable.", 404);
  }

  const now = new Date();

  if (record.expiresAt <= now) {
    return jsonError("Ce lien de téléchargement a expiré.", 410);
  }

  if (record.downloadCount >= record.maxDownloads) {
    return jsonError("Le nombre maximal de téléchargements est atteint.", 410);
  }

  const stream = await openPrivatePdfStream(record.orderItem.product.pdfStorageKey);
  if (!stream) {
    return jsonError("Le fichier est momentanément indisponible. Réessayez plus tard.", 404);
  }

  // Compte le téléchargement de façon atomique (protège contre les requêtes simultanées).
  const claimed = await prisma.downloadToken.updateMany({
    where: {
      id: record.id,
      downloadCount: { lt: record.maxDownloads },
      expiresAt: { gt: now },
    },
    data: { downloadCount: { increment: 1 }, lastUsedAt: now },
  });

  if (claimed.count === 0) {
    await stream.cancel().catch(() => undefined);
    return jsonError("Ce lien de téléchargement n'est plus valide.", 410);
  }

  const fileName = record.orderItem.product.pdfFileName;
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
