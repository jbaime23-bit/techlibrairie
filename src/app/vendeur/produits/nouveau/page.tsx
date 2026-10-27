// src/app/vendeur/produits/nouveau/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { ProductForm } from "@/components/vendeur/product-form";
import {
  bpsToPercent,
  getDefaultCommissionRateBps,
  resolveCommissionRateBps,
} from "@/lib/commission";

export const metadata: Metadata = {
  title: "Publier un ouvrage",
};

export const dynamic = "force-dynamic";

export default async function NouveauProduitPage() {
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

  return (
    <div className="mx-auto max-w-2xl">
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
