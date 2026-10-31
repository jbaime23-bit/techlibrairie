// src/app/vendeur/produits/nouveau/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { ProductForm } from "@/components/vendeur/product-form";
import { testBlobTokens } from "@/lib/storage-check";
import {
  bpsToPercent,
  getDefaultCommissionRateBps,
  resolveCommissionRateBps,
} from "@/lib/commission";

export const metadata: Metadata = {
  title: "Publier un ouvrage",
};

export const dynamic = "force-dynamic";

export default async function NouveauProduitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const context = await loadSellerPage("/vendeur/produits/nouveau");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const { seller } = context;

  const [categories, defaultRateBps] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getDefaultCommissionRateBps(),
  ]);

  const commissionPercent = bpsToPercent(
    resolveCommissionRateBps(seller.commissionRateBps, defaultRateBps)
  );

  // Test du stockage : réservé aux administrateurs (aucune valeur secrète n'est affichée).
  const isAdmin = context.user.role === "ADMIN";
  const runTest = isAdmin && firstParam(sp.test) === "1";
  const storage = runTest ? await testBlobTokens() : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {isAdmin && (
        <div className="card text-sm">
          <h2 className="text-lg font-semibold">Vérifier le stockage des fichiers</h2>
          <p className="mt-1 text-slate-600">
            Test réservé à l&apos;administrateur : il enregistre puis efface un petit fichier dans chaque
            stockage (PDF privés et couvertures publiques).
          </p>

          {!storage ? (
            <a href="/vendeur/produits/nouveau?test=1" className="btn-secondary mt-3">
              Lancer le test du stockage
            </a>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">
                Environnement : <strong>{storage.environment}</strong> · variables de stockage vues par le
                site : {storage.variableNames.length > 0 ? storage.variableNames.join(", ") : "aucune"}
              </p>

              <ul className="space-y-2">
                {storage.results.map((result) => (
                  <li
                    key={result.variable}
                    className={`rounded-lg border px-3 py-2 ${
                      result.ok
                        ? "border-green-200 bg-green-50 text-green-900"
                        : "border-red-200 bg-red-50 text-red-900"
                    }`}
                  >
                    <p className="font-semibold">
                      {result.ok ? "OK" : "ÉCHEC"} : {result.role}
                    </p>
                    <p className="text-xs">
                      {result.variable} · forme du jeton :{" "}
                      {result.present ? (result.shapeOk ? "correcte" : "inhabituelle") : "absent"}
                    </p>
                    <p className="mt-1 break-words text-xs">{result.message}</p>
                  </li>
                ))}
              </ul>

              {storage.hints.length > 0 && (
                <div className="alert-error">
                  <p className="font-semibold">À faire :</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {storage.hints.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {storage.results.every((result) => result.ok) && (
                <p className="font-semibold text-green-800">
                  Les deux stockages fonctionnent. Vous pouvez publier votre ouvrage.
                </p>
              )}

              <a href="/vendeur/produits/nouveau?test=1" className="btn-secondary">
                Relancer le test
              </a>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h1 className="text-2xl font-bold">Publier un ouvrage</h1>
        <p className="mt-1 text-sm text-slate-600">
          Votre PDF est publié automatiquement dès l&apos;envoi du formulaire.
        </p>

        <div className="mt-6">
          <ProductForm
            sellerId={seller.id}
            categories={categories}
            commissionPercent={commissionPercent}
          />
        </div>
      </div>
    </div>
  );
                      }
