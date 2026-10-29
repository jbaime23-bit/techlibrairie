// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ConsentBanner } from "@/components/legal/consent-banner";
import { getConsent } from "@/lib/consent";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "TechLibrairie - Livres et guides techniques en PDF",
    template: "%s | TechLibrairie",
  },
  description:
    "La plateforme multi-vendeurs de livres et guides techniques au format PDF. Paiement en ligne sécurisé, téléchargement immédiat.",
  // Vérification de propriété du site pour Google AdSense (n'affiche aucune publicité).
  other: {
    "google-adsense-account": "ca-pub-3883537883013867",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const consent = await getConsent();

  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        {consent === null && <ConsentBanner />}
      </body>
    </html>
  );
}
