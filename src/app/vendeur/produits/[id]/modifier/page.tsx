// src/app/vendeur/produits/[id]/modifier/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import {
  ProductEditForm,
  type EditableProduct,
} from "@/components/vendeur/product-edit-form";
import {
  bpsToPercent,
  getDefaultCommissionRateBps,
  resolveCommissionRateBps,
} from "@/lib/commission";
import { formatFileSize, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Modifier un ouvrage",
};

export const dynamic = "force-dynamic";

export default async function ModifierProduitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    notFound();
  }

  const context = await loadSellerPage(`/vendeur/produits/${id}/modifier`);

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const { seller } = context;

  const product = await prisma.product.findFirst({
    where: { id, sellerId: seller.id },
  });

  if (!product) {
    notFound();
  }

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

  const editable: EditableProduct = {
    id: product.id,
    title: product.title,
    description: product.description,
    categoryId: product.categoryId,
    language: product.language,
    pageCount: product.pageCount,
    isXof: product.currency === "XOF",
    priceValue: String(product.priceAmount),
    priceLabel: formatPrice(product.priceAmount, product.currency),
    coverImageUrl: product.coverImageUrl,
    pdfFileName: product.pdfFileName,
    pdfSizeLabel: formatFileSize(product.pdfSizeBytes),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/vendeur/produits"
        className="text-sm font-semibold text-brand-700 hover:underline"
      >
        Retour à mes produits
      </Link>

      <div className="card mt-4">
        <h1 className="text-2xl font-bold">Modifier l&apos;ouvrage</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les modifications sont publiées immédiatement.
        </p>

        {product.status === "SUSPENDED" && (
          <div className="alert-error mt-4">
            Cet ouvrage est suspendu par l&apos;administration. Vous pouvez le
            modifier, mais il ne sera remis en vente qu&apos;après son
            rétablissement par l&apos;équipe.
          </div>
        )}

        <div className="mt-6">
          <ProductEditForm
            sellerId={seller.id}
            product={editable}
            categories={categories}
            commissionPercent={commissionPercent}
          />
        </div>
      </div>
    </div>
  );
    }
