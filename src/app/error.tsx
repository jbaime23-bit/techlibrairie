// src/app/error.tsx
// Page d'erreur affichée quand une page plante. Aucun détail technique n'est montré
// au visiteur : seulement une référence qu'il peut communiquer au support.
"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erreur de page :", error);
  }, [error]);

  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nous n&apos;avons pas pu afficher cette page. Vous pouvez réessayer ; si le
          problème persiste, contactez-nous en indiquant la référence ci-dessous.
        </p>

        {error.digest && (
          <p className="mt-3 text-xs text-slate-500">
            Référence : <code className="rounded bg-slate-100 px-1">{error.digest}</code>
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="btn-primary">
            Réessayer
          </button>
          <Link href="/" className="btn-secondary">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
