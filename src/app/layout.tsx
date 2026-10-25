// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ConsentBanner } from "@/components/legal/consent-banner";
import { getConsent } from "@/lib/consent";
import Script from "next/script";

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

        {/* Bloc Publicitaire Flottant Adsterra à Gauche */}
        <div
          id="adsterra-left-container"
          style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            width: "300px",
            backgroundColor: "#f9f9f9",
            boxShadow: "0px 4px 15px rgba(0,0,0,0.3)",
            borderRadius: "8px",
            zIndex: 9999,
            overflow: "hidden",
            fontFamily: "Arial, sans-serif",
            border: "1px solid #ddd",
          }}
        >
          <div
            style={{
              background: "#222",
              color: "#fff",
              padding: "6px 12px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                fontWeight: "bold",
                color: "#bbb",
              }}
            >
              Annonce
            </span>
            <span
              onClick={() => {
                const el = document.getElementById("adsterra-left-container");
                if (el) el.style.display = "none";
              }}
              style={{
                cursor: "pointer",
                fontWeight: "bold",
                color: "#ff4d4d",
                fontSize: "14px",
                padding: "0 4px",
              }}
            >
              ✕
            </span>
          </div>

          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#000",
              minHeight: "250px",
            }}
          >
            <Script id="adsterra-options" strategy="afterInteractive">
              {`
                window.atOptions = {
                  'key' : 'b9b40b1c4e412de03b6465589ab82662',
                  'format' : 'iframe',
                  'height' : 250,
                  'width' : 300,
                  'params' : {}
                };
              `}
            </Script>
            <Script
              src="https://www.highrevenueformat.com/b9b40b1c4e412de03b6465589ab82662/invoke.js"
              strategy="afterInteractive"
            />
          </div>
        </div>
      </body>
    </html>
  );
}
