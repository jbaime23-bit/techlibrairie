// src/lib/site-url.ts
// Adresse officielle du site, sans "/" final (utilisée pour les liens de partage).

const DEFAULT_SITE_URL = "https://techlibrairie.com";

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (configured && configured.length > 0 ? configured : DEFAULT_SITE_URL).replace(/\/+$/, "");
}
