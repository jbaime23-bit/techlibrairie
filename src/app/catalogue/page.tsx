// src/app/catalogue/page.tsx
import React from "react";

interface PageProps {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CataloguePage(props: PageProps) {
  // Extraction asynchrone pour Next.js 15
  const sp = await props.searchParams;
  const recherche = typeof sp?.q === "string" ? sp.q : "";

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Catalogue des ouvrages</h1>
      {recherche && (
        <p className="text-sm text-slate-600 mb-4">
          Résultats de recherche pour : <strong>{recherche}</strong>
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">Les livres disponibles s'afficheront ici.</p>
        </div>
      </div>
    </div>
  );
}
