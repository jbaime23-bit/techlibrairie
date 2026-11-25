// src/lib/source-files.ts
// Version Word (.docx) d'un manuscrit : règles des chemins de stockage et contrôle du fichier (serveur).

import { DOCX_CONTENT_TYPE } from "@/lib/source-constants";
import { openPrivatePdfStream } from "@/lib/storage";

// Certains téléphones annoncent un .docx comme « octet-stream » : le contenu est vérifié après l'envoi.
export const SOURCE_ALLOWED_TYPES = [DOCX_CONTENT_TYPE, "application/octet-stream", "application/zip"];

/** Chemin d'un fichier Word déposé par l'auteur : sources/<profil vendeur>/<nom>.docx. */
export function isOwnedSourceKey(key: string, sellerId: string): boolean {
  const prefix = `sources/${sellerId}/`;

  return (
    key.startsWith(prefix) &&
    !key.slice(prefix.length).includes("/") &&
    key.toLowerCase().endsWith(".docx") &&
    !key.includes("..") &&
    !key.includes("\\") &&
    key.length <= 300
  );
}

/** Chemin d'un fichier Word joint par l'administration : sources/admin/<type>-<id>/<nom>.docx. */
export function isAdminSourceKey(key: string): boolean {
  return /^sources\/admin\/(?:projet|manuscrit)-[a-z0-9]{1,40}\/[A-Za-z0-9._-]{1,200}\.docx$/i.test(key);
}

export function sanitizeDocxName(name: string): string {
  const cleaned = name.replace(/[\\/]/g, "_").slice(0, 200);
  return cleaned.toLowerCase().endsWith(".docx") ? cleaned : `${cleaned}.docx`;
}

/** Un fichier .docx est une archive ZIP : ses quatre premiers octets sont « PK\x03\x04 ». */
export async function looksLikeDocx(key: string): Promise<boolean> {
  try {
    const stream = await openPrivatePdfStream(key);
    if (!stream) return false;

    const reader = stream.getReader();
    const chunk = await reader.read();
    await reader.cancel().catch(() => undefined);

    const bytes = chunk.value;

    return Boolean(
      bytes &&
        bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 0x03 &&
        bytes[3] === 0x04
    );
  } catch {
    return false;
  }
}
