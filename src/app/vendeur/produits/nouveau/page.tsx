src/app/vendeur/produits/nouveau/page.tsx: 1 version(s), last in block 11, 58 lines
src/components/vendeur/product-form.tsx: 2 version(s), last in block 27, 391 lines
src/lib/product-validation.ts: 3 version(s), last in block 27, 111 lines
=========== exports of product-validation
7:export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo
8:export const MAX_COVER_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo
9:export const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
11:export const PRODUCT_LANGUAGES = [
16:export const PRODUCT_CURRENCIES = [
21:export const MIN_PRICE = { XOF: 100 } as const;
22:export const MAX_PRICE = { XOF: 10_000_000 } as const;
24:export const productFieldsSchema = z
111:export type ProductFields = z.infer<typeof productFieldsSchema>;

=========== nouveau/page.tsx
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
