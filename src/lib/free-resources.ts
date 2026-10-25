// src/lib/free-resources.ts
// Téléchargements gratuits avec attente publicitaire.
//
// Principe : quand la page d'un PDF gratuit est ouverte, le serveur remet un jeton signé qui contient
// l'heure d'ouverture (aucune base de données nécessaire). La route de téléchargement refuse tout jeton
// de moins de 30 secondes : l'attente est donc imposée par le serveur, pas seulement par la page.
// Un jeton reste utilisable 20 minutes.

import { createHmac, timingSafeEqual } from "crypto";

export const FREE_WAIT_SECONDS = 30;
export const FREE_LINK_MAX_AGE_SECONDS = 20 * 60;
export const FREE_PDF_PREFIX = "free/";

// Tolérance d'une seconde pour les petits décalages d'horloge entre les instances du serveur.
const CLOCK_TOLERANCE_SECONDS = 1;

/** Vérifie qu'une clé de stockage désigne bien un PDF du dossier des ressources gratuites. */
export function isFreePdfKey(storageKey: string): boolean {
  return (
    storageKey.startsWith(FREE_PDF_PREFIX) &&
    storageKey.toLowerCase().endsWith(".pdf") &&
    !storageKey.includes("..") &&
    !storageKey.includes("\\")
  );
}

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET est manquant.");
  }
  return `tl-free-v1:${secret}`;
}

function sign(resourceId: string, issuedAt: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${resourceId}:${issuedAt}`)
    .digest("hex");
}

/** Jeton remis à l'ouverture de la page d'une ressource gratuite. */
export function createWaitToken(resourceId: string, now: number = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  return `${issuedAt}.${sign(resourceId, issuedAt)}`;
}

export type WaitTokenCheck =
  | { ok: true }
  | { ok: false; reason: "invalide" | "attente" | "expire" };

/** Vérifie la signature d'un jeton, puis le délai écoulé depuis l'ouverture de la page. */
export function verifyWaitToken(
  resourceId: string,
  token: string,
  now: number = Date.now()
): WaitTokenCheck {
  const match = /^(\d{9,12})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return { ok: false, reason: "invalide" };

  const issuedAt = Number(match[1]);
  const expected = sign(resourceId, issuedAt);

  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(match[2]))) {
    return { ok: false, reason: "invalide" };
  }

  const elapsed = Math.floor(now / 1000) - issuedAt;

  if (elapsed < FREE_WAIT_SECONDS - CLOCK_TOLERANCE_SECONDS) {
    return { ok: false, reason: "attente" };
  }
  if (elapsed > FREE_LINK_MAX_AGE_SECONDS) {
    return { ok: false, reason: "expire" };
  }

  return { ok: true };
}

/** Nom de fichier sûr pour l'en-tête Content-Disposition (version ASCII et version UTF-8). */
export function downloadFileNames(fileName: string, fallback: string): { ascii: string; utf8: string } {
  const base = (fileName || fallback).replace(/\.pdf$/i, "").trim() || fallback;

  const ascii =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "telechargement";

  const utf8 = encodeURIComponent(`${base}.pdf`).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return { ascii: `${ascii}.pdf`, utf8 };
}
