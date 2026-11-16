// src/app/api/edition/manuscrit/upload/route.ts
// Génère les jetons d'envoi direct (navigateur vers Vercel Blob) pour les manuscrits soumis à l'examen
// éditorial. Réservé aux auteurs actifs ; fichiers rangés dans le dossier privé manuscrits/<vendeur>/.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSellerContext } from "@/lib/seller";
import { getPrivateBlobToken } from "@/lib/storage";
import { isOwnedManuscriptKey } from "@/lib/manuscript-validation";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export const dynamic = "force-dynamic";

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
        const context = await getSellerContext();

        if (context.status !== "ok") {
          throw new Error("Accès refusé : un espace auteur actif est requis.");
        }

        if (!isOwnedManuscriptKey(pathname, context.seller.id)) {
          throw new Error("Chemin de fichier non autorisé.");
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
    console.error("Envoi d'un manuscrit : jeton refusé :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Envoi refusé." },
      { status: 400 }
    );
  }
}
