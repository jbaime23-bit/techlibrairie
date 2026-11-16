// src/app/robots.ts
// Consignes aux moteurs de recherche : les espaces privés et les pages techniques ne sont pas indexés.

import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/couverture/"],
        disallow: [
          "/admin",
          "/api/admin",
          "/api/checkout",
          "/api/webhooks",
          "/api/cron",
          "/api/gratuit",
          "/api/telechargement",
          "/api/upload",
          "/api/auth",
          "/api/diagnostic",
          "/acheteur",
          "/vendeur",
          "/profil",
          "/support",
          "/favoris",
          "/panier",
          "/paiement",
          "/commander-imprime",
          "/compte-supprime",
          "/initialisation",
          "/verifier-email",
          "/reinitialiser-mot-de-passe",
          "/mot-de-passe-oublie",
          "/connexion",
          "/inscription",
          "/edition/connexion",
          "/edition/inscription",
          "/edition/deposer",
          "/boutique/acheteur",
          "/boutique/vendeur",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
