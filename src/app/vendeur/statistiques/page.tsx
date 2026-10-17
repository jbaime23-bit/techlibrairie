// src/app/vendeur/statistiques/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { BarChart } from "@/components/charts/bar-chart";
import {
  STATS_PERIODS,
  getSalesStats,
  parsePeriod,
  shortDateLabel,
} from "@/lib/stats";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mes statistiques",
};

export const dynamic = "force-dynamic";

export default async function StatistiquesVendeurPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const context = await loadSellerPage("/vendeur/statistiques");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const days = parsePeriod(sp.jours);
  const stats = await getSalesStats({ days, sellerId: context.seller.id });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mes statistiques</h1>

        <div className="flex gap-2 text-sm">
          {STATS_PERIODS.map((period) => (
            <Link
              key={period}
              href={`/vendeur/statistiques?jours=${period}`}
              className={period === days ? "btn-primary" : "btn-secondary"}
            >
              {period} jours
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-600">Ventes</p>
          <p className="mt-1 text-2xl font-bold">{stats.totals.items}</p>
          <p className="text-xs text-slate-500">
            dans {stats.totals.orders} commande{stats.totals.orders > 1 ? "s" : ""}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Chiffre d&apos;affaires</p>
          <p className="mt-1 text-2xl font-bold">{formatPrice(stats.totals.revenue, "XOF")}</p>
        </div>
        <div className="card border-brand-200 bg-brand-50">
          <p className="text-sm text-slate-600">Vos gains</p>
          <p className="mt-1 text-2xl font-bold text-brand-800">
            {formatPrice(stats.totals.seller, "XOF")}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Commission de la boutique</p>
          <p className="mt-1 text-2xl font-bold">{formatPrice(stats.totals.commission, "XOF")}</p>
        </div>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">Vos gains par jour</h2>
        <div className="mt-4">
          <BarChart
            points={stats.series.map((point) => ({
              label: shortDateLabel(point.date),
              value: point.seller,
              tooltip: formatPrice(point.seller, "XOF"),
            }))}
            ariaLabel={`Gains par jour sur les ${days} derniers jours`}
            maxLabel={`Maximum : ${formatPrice(
              stats.series.reduce((highest, point) => Math.max(highest, point.seller), 0),
              "XOF"
            )}`}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Vos ouvrages les plus vendus</h2>

        {stats.topProducts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Aucune vente sur cette période.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4 font-medium">Ouvrage</th>
                  <th className="py-2 pr-4 font-medium">Ventes</th>
                  <th className="py-2 pr-4 font-medium">Chiffre d&apos;affaires</th>
                  <th className="py-2 font-medium">Vos gains</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((product) => (
                  <tr key={product.productId} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">{product.title}</td>
                    <td className="py-2 pr-4">{product.sales}</td>
                    <td className="py-2 pr-4">{formatPrice(product.revenue, "XOF")}</td>
                    <td className="py-2">{formatPrice(product.seller, "XOF")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Seules les commandes payées sont comptées (ni remboursées, ni annulées), à la date du
        paiement, en FCFA. Les jours s&apos;arrêtent à minuit (heure du Burkina Faso).
        {stats.otherCurrencySales > 0
          ? ` ${stats.otherCurrencySales} vente(s) dans une autre devise ne sont pas comptées ici.`
          : ""}
      </p>
    </div>
  );
          }
