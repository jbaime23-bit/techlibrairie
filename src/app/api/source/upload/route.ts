// src/app/api/source/upload/route.ts
// Jetons d'envoi direct (navigateur vers le stockage privé) pour la version Word d'un manuscrit :
// - un auteur actif, vers sources/<son profil>/ ;
// - un administrateur, vers sources/admin/<dossier>/.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminOrNull } from "@/lib/admin";
import { getSellerContext } from "@/lib/seller";
import { getPrivateBlobToken } from "@/lib/storage";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";
import { SOURCE_ALLOWED_TYPES, isAdminSourceKey, isOwnedSourceKey } from "@/lib/source-files";

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
        if (isAdminSourceKey(pathname)) {
          const admin = await getAdminOrNull();

          if (!admin) {
            throw new Error("Accès refusé : réservé aux administrateurs.");
          }
        } else {
          const context = await getSellerContext();

          if (context.status !== "ok") {
            throw new Error("Accès refusé : un espace auteur actif est requis.");
          }

          if (!isOwnedSourceKey(pathname, context.seller.id)) {
            throw new Error("Chemin de fichier non autorisé.");
          }
        }

        return {
          allowedContentTypes: SOURCE_ALLOWED_TYPES,
          maximumSizeInBytes: MAX_PDF_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Envoi d'une version Word : jeton refusé :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Envoi refusé." },
      { status: 400 }
    );
  }
}
