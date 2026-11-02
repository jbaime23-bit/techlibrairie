// src/lib/storage.ts
// Stockage des fichiers avec Vercel Blob : UN SEUL store, PRIVÉ (variable BLOB_READ_WRITE_TOKEN).
// - PDF : jamais d'URL publique. Le fichier n'est lu que côté serveur, après vérification du droit
//   de téléchargement.
// - Couvertures : rangées dans le même store privé et affichées par la route /api/couverture/...
//   (seules les images du dossier "couvertures/" peuvent être lues par cette route).

import { put, get, del } from "@vercel/blob";
import { slugify } from "@/lib/utils";
import {
  ALLOWED_COVER_TYPES,
  MAX_COVER_SIZE_BYTES,
} from "@/lib/product-validation";

/**
 * Nettoie un jeton collé dans Vercel : retire espaces, retours à la ligne, caractères invisibles,
 * guillemets, et le nom de la variable si elle a été collée avec la valeur ("NOM=valeur").
 */
function cleanToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let value = raw;
  const equalsIndex = value.lastIndexOf("=");
  if (equalsIndex >= 0) {
    value = value.slice(equalsIndex + 1);
  }

  const cleaned = value.replace(/[^\x21-\x7E]/g, "").replace(/["'`]/g, "");
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Jeton du store privé (PDF et couvertures), nettoyé. */
export function getPrivateBlobToken(): string | undefined {
  return cleanToken(process.env.BLOB_READ_WRITE_TOKEN);
}

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
    result = await get(storageKey, { access: "private", token: getPrivateBlobToken() });
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
  const result = await get(storageKey, { access: "private", token: getPrivateBlobToken() });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  return result.stream;
}

/** Supprime un PDF du store privé. */
export async function deletePrivateFile(storageKey: string): Promise<void> {
  await del(storageKey, { token: getPrivateBlobToken() });
}

// ---------------------------------------------------------------------------
// Couvertures
// ---------------------------------------------------------------------------

export const COVER_PATH_PREFIX = "couvertures/";
export const COVER_URL_PREFIX = "/api/couverture/";

/** Vérifie qu'une clé de stockage désigne bien une image de couverture. */
export function isCoverKey(key: string): boolean {
  return (
    key.startsWith(COVER_PATH_PREFIX) &&
    /\.(jpg|jpeg|png|webp)$/i.test(key) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    key.length <= 300
  );
}

/** Clé de stockage d'une couverture à partir de son adresse sur le site, ou null. */
export function coverKeyFromUrl(url: string): string | null {
  if (!url.startsWith(COVER_URL_PREFIX)) return null;

  const key = `${COVER_PATH_PREFIX}${url.slice(COVER_URL_PREFIX.length)}`;
  return isCoverKey(key) ? key : null;
}

/**
 * Envoie une image de couverture dans le store privé et renvoie son adresse sur le site
 * (par exemple /api/couverture/<vendeur>/<nom>-<suffixe>.jpg).
 */
export async function uploadPublicCover(
  file: File,
  sellerId: string
): Promise<string> {
  const token = getPrivateBlobToken();
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN est manquant : impossible d'envoyer la couverture."
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
  const pathname = `${COVER_PATH_PREFIX}${sellerId}/${baseName}.${extension}`;

  const result = await put(pathname, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
    token,
  });

  return `${COVER_URL_PREFIX}${result.pathname.slice(COVER_PATH_PREFIX.length)}`;
}

/** Supprime une couverture (adresse du site) ; accepte aussi une ancienne URL absolue d'un store public. */
export async function deletePublicCover(url: string): Promise<void> {
  const key = coverKeyFromUrl(url);

  if (key) {
    await del(key, { token: getPrivateBlobToken() });
    return;
  }

  const legacyToken = cleanToken(process.env.BLOB_PUBLIC_READ_WRITE_TOKEN);
  if (legacyToken && /^https?:\/\//.test(url)) {
    await del(url, { token: legacyToken });
  }
  }
