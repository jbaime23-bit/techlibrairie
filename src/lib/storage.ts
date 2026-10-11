// src/lib/storage.ts
// Stockage des fichiers avec Vercel Blob.
// - PDF : store PRIVÉ. Aucune URL publique : le fichier n'est lu que côté
//   serveur, après vérification du droit de téléchargement.
// - Couvertures : store PUBLIC (BLOB_PUBLIC_READ_WRITE_TOKEN).

import { put, get, del } from "@vercel/blob";
import { slugify } from "@/lib/utils";
import {
  ALLOWED_COVER_TYPES,
  MAX_COVER_SIZE_BYTES,
} from "@/lib/product-validation";

/** Préfixe de stockage des PDF d'un vendeur. */
export function pdfPathPrefix(sellerId: string): string {
  return `pdfs/${sellerId}/`;
}

/**
 * Vérifie qu'une clé de stockage désigne bien un PDF appartenant à ce vendeur.
 * Empêche un vendeur de référencer le fichier d'un autre vendeur.
 */
export function isOwnedPdfKey(storageKey: string, sellerId: string): boolean {
  return (
    storageKey.startsWith(pdfPathPrefix(sellerId)) &&
    storageKey.toLowerCase().endsWith(".pdf") &&
    !storageKey.includes("..") &&
    !storageKey.includes("\\")
  );
}

export interface PdfInspection {
  exists: boolean;
  isPdf: boolean;
  sizeBytes: number | null;
}

/**
 * Vérifie qu'un PDF existe dans le store privé et commence par la
 * signature %PDF-. Ne télécharge que les premiers octets.
 */
export async function inspectPrivatePdf(
  storageKey: string
): Promise<PdfInspection> {
  let result;
  try {
    result = await get(storageKey, { access: "private" });
  } catch {
    return { exists: false, isPdf: false, sizeBytes: null };
  }

  if (!result || result.statusCode !== 200 || !result.stream) {
    return { exists: false, isPdf: false, sizeBytes: null };
  }

  const reader = result.stream.getReader();
  let received = new Uint8Array(0);

  while (received.length < 5) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const merged = new Uint8Array(received.length + value.length);
    merged.set(received);
    merged.set(value, received.length);
    received = merged;
  }

  await reader.cancel().catch(() => undefined);

  const signature = new TextDecoder().decode(received.slice(0, 5));
  const blobInfo = result.blob as unknown as { size?: number };
  const sizeBytes = typeof blobInfo.size === "number" ? blobInfo.size : null;

  return { exists: true, isPdf: signature === "%PDF-", sizeBytes };
}

/**
 * Ouvre un PDF du store privé en flux (stream).
 * À appeler uniquement après avoir vérifié le droit de téléchargement.
 * Renvoie null si le fichier est introuvable.
 */
export async function openPrivatePdfStream(
  storageKey: string
): Promise<ReadableStream<Uint8Array> | null> {
  const result = await get(storageKey, { access: "private" });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  return result.stream;
}

/** Supprime un PDF du store privé. */
export async function deletePrivateFile(storageKey: string): Promise<void> {
  await del(storageKey);
}

/** Envoie une image de couverture dans le store public et renvoie son URL. */
export async function uploadPublicCover(
  file: File,
  sellerId: string
): Promise<string> {
  const token = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_PUBLIC_READ_WRITE_TOKEN est manquant : impossible d'envoyer la couverture."
    );
  }
  if (file.size === 0 || file.size > MAX_COVER_SIZE_BYTES) {
    throw new Error("L'image de couverture doit faire entre 1 octet et 2 Mo.");
  }
  if (!ALLOWED_COVER_TYPES.includes(file.type)) {
    throw new Error("La couverture doit être au format JPEG, PNG ou WebP.");
  }

  const extension =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const baseName = slugify(file.name.replace(/\.[^/.]+$/, "")) || "couverture";
  const pathname = `couvertures/${sellerId}/${baseName}.${extension}`;

  const result = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
    token,
  });

  return result.url;
}

/** Supprime une couverture du store public. */
export async function deletePublicCover(url: string): Promise<void> {
  const token = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
  if (!token) return;
  await del(url, { token });
               }
