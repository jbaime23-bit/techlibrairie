// src/lib/edition-files.ts
// Épreuves (bons à tirer) des éditions à compte d'auteur : elles sont rangées dans le dossier privé
// "edition/<identifiant du produit>/", que la maintenance ne parcourt pas.

export const EDITION_FILE_PREFIX = "edition/";

/** Vérifie qu'une clé de stockage est bien une épreuve de CE produit. */
export function isEditionProofKey(key: string, productId: string): boolean {
  return (
    key.startsWith(`${EDITION_FILE_PREFIX}${productId}/`) &&
    key.toLowerCase().endsWith(".pdf") &&
    !key.includes("..") &&
    !key.includes("\\") &&
    key.length <= 300
  );
}

/** Identifiant du produit contenu dans un chemin edition/<produit>/<fichier>.pdf, ou null. */
export function productIdFromEditionPath(pathname: string): string | null {
  const match = /^edition\/([a-z0-9]{1,40})\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.pdf$/i.exec(pathname);
  return match ? match[1] : null;
}
