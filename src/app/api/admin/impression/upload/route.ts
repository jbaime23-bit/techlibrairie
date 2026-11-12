// src/app/api/admin/impression/upload/route.ts
// Génère les jetons d'envoi direct (navigateur vers Vercel Blob) pour les PDF d'impression.
// Réservé aux administrateurs ; fichiers rangés dans lulu/<ouvrage>/ et seulement pour un livre de l'édition.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { getPrivateBlobToken } from "@/lib/storage";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

const PATH_PATTERN = /^lulu\/([a-z0-9]{1,40})\/(interieur|couverture)[A-Za-z0-9._-]{0,120}\.pdf$/i;

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

        const match = PATH_PATTERN.exec(pathname);
        if (!match) {
          throw new Error("Chemin de fichier non autorisé.");
        }

        const product = await prisma.product.findUnique({
          where: { id: match[1] },
          select: { kind: true },
        });

        if (!product || product.kind !== "BOOK_EDITION") {
          throw new Error("Ce produit n'est pas un livre de l'édition.");
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
