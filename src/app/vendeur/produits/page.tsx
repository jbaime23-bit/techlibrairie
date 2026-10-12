// src/app/vendeur/produits/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { ProductStatusToggle } from "@/components/vendeur/product-status-toggle";
import { formatDate, formatFileSize, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mes produits",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ProductStatus, string> = {
  PUBLISHED: "En vente",
  UNPUBLISHED: "Retiré",
  SUSPENDED: "Suspendu",
};

const STATUS_STYLES: Record<ProductStatus, string> = {
  PUBLISHED: "bg-green-100 text-green-800",
  UNPUBLISHED: "bg-slate-100 text-slate-700",
  SUSPENDED: "bg-red-100 text-red-800",
};

export default async function ProduitsPage() {
  const context = await loadSellerPage("/vendeur/produits");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const products = await prisma.product.findMany({
    where: { sellerId: context.seller.id },
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mes produits</h1>
        <Link href="/vendeur/produits/nouveau" className="btn-primary">
          Nouveau produit
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="card text-center">
          <p className="text-sm text-slate-600">
            Vous n&apos;avez encore publié aucun ouvrage.
          </p>
          <div className="mt-4">
            <Link href="/vendeur/produits/nouveau" className="btn-primary">
              Publier mon premier PDF
            </Link>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Ouvrage</th>
                <th className="px-4 py-3 font-medium">Prix</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Ventes</th>
                <th className="px-4 py-3 font-medium">Publié le</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {product.coverImageUrl ? (
                        <Image
                          src={product.coverImageUrl}
                          alt={`Couverture de ${product.title}`}
                          width={40}
                          height={56}
                          className="h-14 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-10 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                          PDF
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{product.title}</p>
                        <p className="text-xs text-slate-500">
                          {product.category?.name ?? "Sans catégorie"} ·{" "}
                          {formatFileSize(product.pdfSizeBytes)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatPrice(product.priceAmount, product.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[product.status]}`}
                    >
                      {STATUS_LABELS[product.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{product.salesCount}</td>
                  <td className="px-4 py-3">{formatDate(product.publishedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <Link
                        href={`/vendeur/produits/${product.id}/modifier`}
                        className="btn-secondary px-3 py-1 text-xs"
                      >
                        Modifier
                      </Link>

                      {product.status === "SUSPENDED" ? (
                        <span className="text-xs text-slate-500">
                          Contactez l&apos;administration
                        </span>
                      ) : (
                        <ProductStatusToggle
                          productId={product.id}
                          status={product.status}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
                  }
