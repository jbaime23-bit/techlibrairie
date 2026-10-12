// src/app/robots.ts
// Consignes aux moteurs de recherche : les espaces privés et les pages techniques ne sont pas indexés.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/acheteur",
          "/vendeur",
          "/profil",
          "/support",
          "/panier",
          "/paiement",
          "/initialisation",
          "/verifier-email",
          "/reinitialiser-mot-de-passe",
          "/mot-de-passe-oublie",
          "/connexion",
          "/inscription",
        ],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
