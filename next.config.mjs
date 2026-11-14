/** @type {import('next').NextConfig} */

const isProduction = process.env.NODE_ENV === "production";

// Politique de sécurité du contenu pour les pages SANS publicité.
// Elle interdit le chargement de scripts, d'images et de connexions provenant
// d'un autre domaine que le site, avec une exception : le stockage de fichiers de Vercel,
// nécessaire à l'envoi des PDF depuis l'administration (PDF gratuits, épreuves, fichiers d'impression).
const strictContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://vercel.com https://*.vercel-storage.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Pages concernées. Les pages avec publicités (accueil, espace vendeur,
// /paiement/retour) sont volontairement exclues.
const STRICT_CSP_PATHS = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/verifier-email",
  "/initialisation",
  "/profil",
  "/panier",
  "/paiement",
  "/acheteur/:path*",
  "/support/:path*",
  "/admin/:path*",
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Les erreurs de typage font échouer le déploiement : la version en ligne reste alors intacte.
  // Le contrôle complet se lit dans l'onglet Actions de GitHub (« Vérification du code »).
  typescript: { ignoreBuildErrors: false },

  // Le style de code n'a jamais été contrôlé : il ne bloque pas le déploiement.
  eslint: { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    const rules = [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
        ],
      },
    ];

    if (isProduction) {
      for (const source of STRICT_CSP_PATHS) {
        rules.push({
          source,
          headers: [
            {
              key: "Content-Security-Policy",
              value: strictContentSecurityPolicy,
            },
          ],
        });
      }
    }

    return rules;
  },
};

export default nextConfig;
