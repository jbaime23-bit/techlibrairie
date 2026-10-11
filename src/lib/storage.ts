// src/lib/storage.ts
// Stockage des fichiers avec Vercel Blob.
// - PDF : store PRIVÉ (BLOB_READ_WRITE_TOKEN). Jamais d'URL publique : le
//   fichier n'est lu que côté serveur, après vérification du jeton d'achat.
// - Couvertures : store PUBLIC (BLOB_PUBLIC_READ_WRITE_TOKEN).

import { put, get, del } from "@vercel/blob";
import { slugify } from "@/lib/utils";

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo
export const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
export const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Retire l'extension et nettoie le nom d'un fichier. */
function safeBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
  return slugify(withoutExtension) || "document";
}

/** Vérifie qu'un fichier est bien un PDF valide et de taille acceptable. */
export async function validatePdfFile(file: File): Promise<void> {
  if (file.size === 0) {
    throw new Error("Le fichier PDF est vide.");
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error("Le fichier PDF dépasse la taille maximale de 50 Mo.");
  }
  if (file.type !== "application/pdf") {
    throw new Error("Seuls les fichiers au format PDF sont acceptés.");
  }

  // Contrôle de la signature réelle du fichier (%PDF-), pas seulement de l'extension.
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const signature = String.fromCharCode(...Array.from(header));
  if (signature !== "%PDF-") {
    throw new Error("Le fichier n'est pas un PDF valide.");
  }
}

export interface StoredPdf {
  storageKey: string;
  fileName: string;
  sizeBytes: number;
}

/** Envoie un PDF dans le store privé et renvoie sa clé de stockage. */
export async function uploadPrivatePdf(
  file: File,
  sellerId: string
): Promise<StoredPdf> {
  await validatePdfFile(file);

  const pathname = `pdfs/${sellerId}/${safeBaseName(file.name)}.pdf`;

  const result = await put(pathname, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/pdf",
  });

  return {
    storageKey: result.pathname,
    fileName: `${safeBaseName(file.name)}.pdf`,
    sizeBytes: file.size,
  };
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

  // Lecture défensive du flux, indépendante des variantes de type du SDK.
  const stream = (
    result as unknown as { stream?: ReadableStream<Uint8Array> | null } | null
  )?.stream;

  return stream ?? null;
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
    throw new Error("L'image de couverture doit faire entre 1 octet et 5 Mo.");
  }
  if (!ALLOWED_COVER_TYPES.includes(file.type)) {
    throw new Error("La couverture doit être au format JPEG, PNG ou WebP.");
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const pathname = `couvertures/${sellerId}/${safeBaseName(file.name)}.${extension}`;

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
