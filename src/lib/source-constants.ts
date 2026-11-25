// src/lib/source-constants.ts
// Constantes partagées (navigateur et serveur) pour la version Word d'un manuscrit.

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Nom de fichier sûr pour le stockage : minuscules, sans accents, tirets. */
export function toSafeSourceName(name: string): string {
  const base = name
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "manuscrit";
}
