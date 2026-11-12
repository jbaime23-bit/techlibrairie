// src/app/api/admin/edition/upload/route.ts
// Génère les jetons d'envoi direct (navigateur vers Vercel Blob) pour les épreuves (bons à tirer).
// Réservé aux administrateurs ; fichiers rangés dans edition/<produit>/ et seulement pour une édition en cours.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { productIdFromEditionPath } from "@/lib/edition-files";
import { getPrivateBlobToken } from "@/lib/storage";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

const OPEN_STAGES = ["IN_LAYOUT", "CHANGES_REQUESTED", "PROOF_PENDING"];

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: getPrivateBlobToken(),
      onBeforeGenerateToken: async (pathname) => {
        const admin = await getAdminOrNull();

        if (!admin) {
          throw new Error("Accès refusé : réservé aux administrateurs.");
        }

        const productId = productIdFromEditionPath(pathname);
        if (!productId) {
          throw new Error("Chemin de fichier non autorisé.");
        }

        const project = await prisma.editionProject.findUnique({
          where: { productId },
          select: { stage: true },
        });

        if (!project || !OPEN_STAGES.includes(project.stage)) {
          throw new Error("Cette édition n'est pas en cours de mise en page.");
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Envoi refusé." },
      { status: 400 }
    );
  }
}
