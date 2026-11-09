// src/lib/lulu-files.ts
// Liens signés et temporaires pour que Lulu puisse télécharger les PDF d'impression (intérieur et
// couverture), qui restent stockés en accès PRIVÉ. Seuls les fichiers du dossier "lulu/" sont concernés.
// Fichier autonome, non branché sur le site.

import { createHmac, timingSafeEqual } from "crypto";
import { getSiteUrl } from "@/lib/site-url";

export const LULU_FILE_PREFIX = "lulu/";
export const LULU_FILE_TTL_SECONDS = 24 * 60 * 60;

const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Vérifie qu'une clé de stockage désigne un PDF d'impression du dossier réservé à Lulu. */
export function isLuluFileKey(key: string): boolean {
  return (
    /^lulu\/[A-Za-z0-9][A-Za-z0-9._/-]{0,250}\.pdf$/i.test(key) &&
    !key.includes("..") &&
    !key.includes("//")
  );
}

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET est manquant.");
  }

  return `tl-lulu-v1:${secret}`;
}

function sign(key: string, expires: number): string {
  return createHmac("sha256", signingSecret()).update(`${key}:${expires}`).digest("hex");
}

/** Adresse temporaire (24 heures par défaut) à transmettre à Lulu pour télécharger un PDF d'impression. */
export function signLuluFileUrl(
  key: string,
  ttlSeconds: number = LULU_FILE_TTL_SECONDS,
  now: number = Date.now()
): string {
  if (!isLuluFileKey(key)) {
    throw new Error("Fichier d'impression non autorisé : il doit se trouver dans le dossier lulu/.");
  }

  const ttl = Math.min(Math.max(Math.floor(ttlSeconds), 60), MAX_TTL_SECONDS);
  const expires = Math.floor(now / 1000) + ttl;

  const query = new URLSearchParams({
    k: key,
    e: String(expires),
    s: sign(key, expires),
  });

  return `${getSiteUrl()}/api/lulu/fichier?${query.toString()}`;
}

/** Contrôle la signature et la durée de validité d'un lien. */
export function verifyLuluFileSignature(
  key: string,
  expires: number,
  signature: string,
  now: number = Date.now()
): boolean {
  if (!isLuluFileKey(key) || !/^[a-f0-9]{64}$/.test(signature)) return false;

  const nowSeconds = Math.floor(now / 1000);
  if (expires <= nowSeconds || expires - nowSeconds > MAX_TTL_SECONDS) return false;

  const expected = sign(key, expires);

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
