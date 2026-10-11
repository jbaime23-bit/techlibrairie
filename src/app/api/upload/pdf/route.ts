// src/app/api/upload/pdf/route.ts
// Génère les jetons d'envoi direct (navigateur -> Vercel Blob) pour les PDF.
// L'authentification se fait dans onBeforeGenerateToken.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSellerContext } from "@/lib/seller";
import { isOwnedPdfKey } from "@/lib/storage";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

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
      onBeforeGenerateToken: async (pathname) => {
        const context = await getSellerContext();

        if (context.status !== "ok") {
          throw new Error("Accès refusé : un compte vendeur actif est requis.");
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Envoi refusé." },
      { status: 400 }
    );
  }
      }
