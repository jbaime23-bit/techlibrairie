// src/app/api/upload/pdf/route.ts
// Génère les jetons d'envoi direct (navigateur -> Vercel Blob) pour les PDF.
// L'authentification se fait dans onBeforeGenerateToken.
// Toute erreur est enregistrée dans les journaux de Vercel (Logs) avec son motif.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSellerContext } from "@/lib/seller";
import { getPrivateBlobToken, isOwnedPdfKey } from "@/lib/storage";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    console.error("Envoi PDF : requête illisible.");
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // Jeton nettoyé : une valeur collée à la main avec un espace ou des guillemets ne bloque plus.
      token: getPrivateBlobToken(),
      onBeforeGenerateToken: async (pathname) => {
        const context = await getSellerContext();

        if (context.status !== "ok") {
          throw new Error(
            `Accès refusé : un compte vendeur actif est requis (état : ${context.status}).`
          );
        }

        if (!isOwnedPdfKey(pathname, context.seller.id)) {
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
    const message = error instanceof Error ? error.message : "Envoi refusé.";
    console.error("Envoi PDF : jeton refusé :", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
