// src/app/admin/statistiques/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, requireAdmin } from "@/lib/admin";
import { BarChart } from "@/components/charts/bar-chart";
import {
  STATS_PERIODS,
  getSalesStats,
  parsePeriod,
  shortDateLabel,
} from "@/lib/stats";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Statistiques",
};

export const dynamic = "force-dynamic";

export default async function AdminStatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/statistiques");

  const days = parsePeriod(firstParam(sp.jours));
  const stats = await getSalesStats({ days });

  const averageBasket =
    stats.totals.orders > 0 ? Math.round(stats.totals.revenue / stats.totals.orders) : 0;
  const maxRevenue = stats.series.reduce((highest, point) => Math.max(highest, point.revenue), 0);
  const maxCommission = stats.series.reduce(
    (highest, point) => Math.max(highest, point.commission),
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Statistiques de la boutique</h1>

        <div className="flex gap-2 text-sm">
          {STATS_PERIODS.map((period) => (
            <Link
              key={period}
              href={`/admin/statistiques?jours=${period}`}
              className={period === days ? "btn-primary" : "btn-secondary"}
            >
              {period} jours
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card">
          <p className="text-sm text-slate-600">Commandes</p>
          <p className="mt-1 text-2xl font-bold">{stats.totals.orders}</p>
          <p className="text-xs text-slate-500">{stats.totals.items} ouvrage(s) vendu(s)</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Chiffre d&apos;affaires</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(stats.totals.revenue, "XOF")}</p>
        </div>
        <div className="card border-brand-200 bg-brand-50">
          <p className="text-sm text-slate-600">Commission boutique</p>
          <p className="mt-1 text-xl font-bold text-brand-800">
            {formatPrice(stats.totals.commission, "XOF")}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Part des vendeurs</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(stats.totals.seller, "XOF")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Panier moyen</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(averageBasket, "XOF")}</p>
        </div>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">Chiffre d&apos;affaires par jour</h2>
        <div className="mt-4">
          <BarChart
            points={stats.series.map((point) => ({
              label: shortDateLabel(point.date),
              value: point.revenue,
              tooltip: `${formatPrice(point.revenue, "XOF")} (${point.orders} commande${point.orders > 1 ? "s" : ""})`,
            }))}
            ariaLabel={`Chiffre d'affaires par jour sur les ${days} derniers jours`}
            maxLabel={`Maximum : ${formatPrice(maxRevenue, "XOF")}`}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Commission de la boutique par jour</h2>
        <div className="mt-4">
          <BarChart
            points={stats.series.map((point) => ({
              label: shortDateLabel(point.date),
              value: point.commission,
              tooltip: formatPrice(point.commission, "XOF"),
            }))}
            ariaLabel={`Commission par jour sur les ${days} derniers jours`}
            maxLabel={`Maximum : ${formatPrice(maxCommission, "XOF")}`}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-lg font-semibold">Ouvrages les plus vendus</h2>

          {stats.topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aucune vente sur cette période.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {stats.topProducts.map((product) => (
                <li key={product.productId} className="flex justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{product.title}</p>
                    <p className="text-xs text-slate-500">{product.sales} vente(s)</p>
                  </div>
                  <p className="font-semibold">{formatPrice(product.revenue, "XOF")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">Vendeurs les plus actifs</h2>

          {stats.topSellers.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aucune vente sur cette période.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {stats.topSellers.map((seller) => (
                <li key={seller.sellerId} className="flex justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{seller.name}</p>
                    <p className="text-xs text-slate-500">
                      {seller.sales} vente(s) · commission {formatPrice(seller.commission, "XOF")}
                    </p>
                  </div>
                  <p className="font-semibold">{formatPrice(seller.revenue, "XOF")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
