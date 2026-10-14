// src/lib/consent.ts
// Choix de l'utilisateur concernant les cookies publicitaires (lecture côté serveur).
// Le cookie "tl_consent" vaut "granted" (accepté) ou "denied" (refusé).
// Les composants navigateur utilisent le même nom de cookie (voir consent-banner.tsx).

import { cookies } from "next/headers";

export const CONSENT_COOKIE = "tl_consent";

export type ConsentChoice = "granted" | "denied";

/** Choix enregistré, ou null si l'utilisateur n'a encore rien choisi. */
export async function getConsent(): Promise<ConsentChoice | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(CONSENT_COOKIE)?.value;
  return value === "granted" || value === "denied" ? value : null;
}
