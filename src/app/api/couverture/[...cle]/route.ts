// src/app/api/couverture/[...cle]/route.ts
// Affiche une image de couverture rangée dans le store privé.
// Seules les images du dossier "couvertures/" sont servies : les PDF ne passent jamais par ici.

import { get } from "@vercel/blob";
import { COVER_PATH_PREFIX, getPrivateBlobToken, isCoverKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

function contentTypeFor(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cle: string[] }> }
) {
  const { cle } = await params;
  const key = `${COVER_PATH_PREFIX}${cle.join("/")}`;

  if (!isCoverKey(key)) {
    return new Response("Introuvable", { status: 404 });
  }

  let result;
  try {
    result = await get(key, { access: "private", token: getPrivateBlobToken() });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }

  if (!result || result.statusCode !== 200 || !result.stream) {
    return new Response("Introuvable", { status: 404 });
  }

  return new Response(result.stream, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(key),
      // Le nom du fichier contient un suffixe aléatoire : l'image ne change jamais.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
