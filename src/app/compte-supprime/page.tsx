// src/app/compte-supprime/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compte supprimé",
  robots: { index: false, follow: false },
};

export default function CompteSupprimePage() {
  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold">Votre compte a été supprimé</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vos données personnelles ont été effacées ou anonymisées. Un email de confirmation vous a
          été envoyé si l&apos;envoi d&apos;emails est possible. Merci d&apos;avoir utilisé TechLibrairie.
        </p>
        <div className="mt-6">
          <Link href="/" className="btn-primary">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
