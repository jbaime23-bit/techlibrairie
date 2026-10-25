// src/app/api/admin/gratuit/upload/route.ts
// Génère les jetons d'envoi direct (navigateur vers Vercel Blob) pour les PDF gratuits.
// Réservé aux administrateurs ; les fichiers sont rangés dans le dossier privé "free/".

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminOrNull } from "@/lib/admin";
import { isFreePdfKey } from "@/lib/free-resources";
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
        const admin = await getAdminOrNull();

        if (!admin) {
          throw new Error("Accès refusé : réservé aux administrateurs.");
        }

        if (!isFreePdfKey(pathname)) {
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
