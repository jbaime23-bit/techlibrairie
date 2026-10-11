// src/app/vendeur/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import {
  bpsToPercent,
  getDefaultCommissionRateBps,
  resolveCommissionRateBps,
} from "@/lib/commission";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tableau de bord vendeur",
};

export const dynamic = "force-dynamic";

export default async function VendeurPage() {
  const context = await loadSellerPage("/vendeur");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const { seller } = context;
  const paidFilter = { sellerId: seller.id, order: { status: "PAID" as const } };

  const [productCounts, salesByCurrency, recentSales, defaultRateBps] =
    await Promise.all([
      prisma.product.groupBy({
        by: ["status"],
        where: { sellerId: seller.id },
        _count: { _all: true },
      }),
      prisma.orderItem.groupBy({
        by: ["currency"],
        where: paidFilter,
        _sum: { unitAmount: true, commissionAmount: true, sellerAmount: true },
        _count: { _all: true },
      }),
      prisma.orderItem.findMany({
        where: paidFilter,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { order: { select: { number: true, paidAt: true } } },
      }),
      getDefaultCommissionRateBps(),
    ]);

  const totalProducts = productCounts.reduce((sum, row) => sum + row._count._all, 0);
  const publishedProducts =
    productCounts.find((row) => row.status === "PUBLISHED")?._count._all ?? 0;
  const totalSales = salesByCurrency.reduce((sum, row) => sum + row._count._all, 0);
  const commissionPercent = bpsToPercent(
    resolveCommissionRateBps(seller.commissionRateBps, defaultRateBps)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {seller.displayName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Commission de la boutique sur vos ventes : {commissionPercent} %.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-600">Produits</p>
          <p className="mt-1 text-3xl font-bold">{totalProducts}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Produits en vente</p>
          <p className="mt-1 text-3xl font-bold">{publishedProducts}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Ventes</p>
          <p className="mt-1 text-3xl font-bold">{totalSales}</p>
        </div>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">Revenus</h2>

        {salesByCurrency.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Vous n&apos;avez pas encore de vente. Publiez un ouvrage pour
            commencer.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4 font-medium">Devise</th>
                  <th className="py-2 pr-4 font-medium">Ventes</th>
                  <th className="py-2 pr-4 font-medium">Chiffre d&apos;affaires</th>
                  <th className="py-2 pr-4 font-medium">Commission boutique</th>
                  <th className="py-2 font-medium">Vos revenus</th>
                </tr>
              </thead>
              <tbody>
                {salesByCurrency.map((row) => (
                  <tr key={row.currency} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{row.currency}</td>
                    <td className="py-2 pr-4">{row._count._all}</td>
                    <td className="py-2 pr-4">
                      {formatPrice(row._sum.unitAmount ?? 0, row.currency)}
                    </td>
                    <td className="py-2 pr-4">
                      {formatPrice(row._sum.commissionAmount ?? 0, row.currency)}
                    </td>
                    <td className="py-2 font-semibold">
                      {formatPrice(row._sum.sellerAmount ?? 0, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dernières ventes</h2>
          <Link
            href="/vendeur/produits"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Mes produits
          </Link>
        </div>

        {recentSales.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Aucune vente pour le moment.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {recentSales.map((sale) => (
              <li
                key={sale.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium">{sale.productTitle}</p>
                  <p className="text-xs text-slate-500">
                    Commande {sale.order.number}
                    {sale.order.paidAt ? ` · ${formatDate(sale.order.paidAt)}` : ""}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatPrice(sale.sellerAmount, sale.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
