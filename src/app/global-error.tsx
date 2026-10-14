// src/app/global-error.tsx
// Dernier filet de sécurité : s'affiche si l'erreur survient dans la mise en page générale.
"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="card max-w-lg text-center">
          <h1 className="text-2xl font-bold">TechLibrairie est momentanément indisponible</h1>
          <p className="mt-2 text-sm text-slate-600">
            Une erreur inattendue est survenue. Veuillez réessayer dans un instant.
          </p>

          {error.digest && (
            <p className="mt-3 text-xs text-slate-500">
              Référence : <code className="rounded bg-slate-100 px-1">{error.digest}</code>
            </p>
          )}

          <div className="mt-6">
            <button type="button" onClick={() => reset()} className="btn-primary">
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
