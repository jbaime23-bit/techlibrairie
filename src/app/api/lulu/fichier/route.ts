// src/app/api/lulu/fichier/route.ts
// Adresse que Lulu appelle pour télécharger un PDF d'impression stocké en accès privé.
// Seuls les liens signés, non expirés et pointant vers le dossier "lulu/" sont servis.

import { inspectPrivatePdf, openPrivatePdfStream } from "@/lib/storage";
import { isLuluFileKey, verifyLuluFileSignature } from "@/lib/lulu-files";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function readSignedKey(request: Request): string | null {
  const params = new URL(request.url).searchParams;

  const key = params.get("k") ?? "";
  const expires = Number(params.get("e"));
  const signature = params.get("s") ?? "";

  if (!isLuluFileKey(key) || !Number.isInteger(expires)) return null;

  return verifyLuluFileSignature(key, expires, signature) ? key : null;
}

function fileHeaders(key: string): Headers {
  const baseName = key.split("/").pop() ?? "livre.pdf";

  return new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${baseName.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
}

const NOT_FOUND = "Introuvable";

export async function GET(request: Request) {
  const key = readSignedKey(request);

  if (!key) {
    return new Response(NOT_FOUND, { status: 404 });
  }

  let stream: ReadableStream<Uint8Array> | null = null;
  try {
    stream = await openPrivatePdfStream(key);
  } catch (error) {
    console.error("Lecture d'un PDF d'impression impossible :", error);
  }

  if (!stream) {
    return new Response(NOT_FOUND, { status: 404 });
  }

  return new Response(stream, { status: 200, headers: fileHeaders(key) });
}

export async function HEAD(request: Request) {
  const key = readSignedKey(request);

  if (!key) {
    return new Response(null, { status: 404 });
  }

  const inspection = await inspectPrivatePdf(key);

  if (!inspection.exists) {
    return new Response(null, { status: 404 });
  }

  return new Response(null, { status: 200, headers: fileHeaders(key) });
}
