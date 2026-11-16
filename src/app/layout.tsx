// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ConsentBanner } from "@/components/legal/consent-banner";
import { getConsent } from "@/lib/consent";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "TechLibrairie Édition | Maison d'édition numérique et boutique de livres PDF",
    template: "%s | TechLibrairie",
  },
  description:
    "TechLibrairie Édition accompagne les auteurs francophones : mise en page professionnelle, publication en PDF et en livre imprimé à la demande, et boutique de livres et guides techniques.",
  // Vérification de propriété du site pour Google AdSense (n'affiche aucune publicité).
  other: {
    "google-adsense-account": "ca-pub-3883537883013867",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
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
