// src/lib/site-url.ts
// Adresse officielle du site, sans "/" final (liens de partage, plan du site, aperçus des réseaux).
// Si la variable NEXT_PUBLIC_APP_URL contient encore une adresse technique de Vercel (*.vercel.app),
// l'adresse officielle est utilisée à la place (en production seulement).

const OFFICIAL_SITE_URL = "https://techlibrairie.com";
const LOCAL_SITE_URL = "http://localhost:3000";

function isTechnicalAddress(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  if (!configured) {
    return isProduction ? OFFICIAL_SITE_URL : LOCAL_SITE_URL;
  }

  if (isProduction && isTechnicalAddress(configured)) {
    return OFFICIAL_SITE_URL;
  }

  return configured;
}
