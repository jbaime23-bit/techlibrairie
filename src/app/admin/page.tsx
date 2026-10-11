// src/app/admin/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Administration",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin("/admin");

  const [
    usersByRole,
    productsByStatus,
    ordersByStatus,
    revenueByCurrency,
    splitByCurrency,
    newMessages,
    adStats,
    recentOrders,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.groupBy({
      by: ["currency"],
      where: { status: "PAID" },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["currency"],
      where: { order: { status: "PAID" } },
      _sum: { commissionAmount: true, sellerAmount: true },
    }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.adSpace.aggregate({
      where: { kind: "LOCAL_BANNER" },
      _sum: { impressions: true, clicks: true },
    }),
    prisma.order.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        buyerEmail: true,
        totalAmount: true,
        currency: true,
        paidAt: true,
      },
    }),
  ]);

  const usersCount = (role: string) =>
    usersByRole.find((row) => row.role === role)?._count._all ?? 0;
  const productsCount = (status: string) =>
    productsByStatus.find((row) => row.status === status)?._count._all ?? 0;
  const ordersCount = (status: string) =>
    ordersByStatus.find((row) => row.status === status)?._count._all ?? 0;

  const currencies = Array.from(
    new Set([
      ...revenueByCurrency.map((row) => row.currency),
      ...splitByCurrency.map((row) => row.currency),
    ])
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-600">Acheteurs</p>
          <p className="mt-1 text-3xl font-bold">{usersCount("BUYER")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Vendeurs</p>
          <p className="mt-1 text-3xl font-bold">{usersCount("SELLER")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Produits en vente</p>
          <p className="mt-1 text-3xl font-bold">{productsCount("PUBLISHED")}</p>
          <p className="text-xs text-slate-500">
            {productsCount("UNPUBLISHED")} retirés · {productsCount("SUSPENDED")} suspendus
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Commandes payées</p>
          <p className="mt-1 text-3xl font-bold">{ordersCount("PAID")}</p>
          <p className="text-xs text-slate-500">
            {ordersCount("PENDING")} en attente · {ordersCount("FAILED")} échouées
          </p>
        </div>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">Chiffre d&apos;affaires et commission</h2>

        {currencies.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Aucune vente pour le moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4 font-medium">Devise</th>
                  <th className="py-2 pr-4 font-medium">Commandes</th>
                  <th className="py-2 pr-4 font-medium">Chiffre d&apos;affaires</th>
                  <th className="py-2 pr-4 font-medium">Commission boutique</th>
                  <th className="py-2 font-medium">Part des vendeurs</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((currency) => {
                  const revenue = revenueByCurrency.find((row) => row.currency === currency);
                  const split = splitByCurrency.find((row) => row.currency === currency);

                  return (
                    <tr key={currency} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{currency}</td>
                      <td className="py-2 pr-4">{revenue?._count._all ?? 0}</td>
                      <td className="py-2 pr-4">
                        {formatPrice(revenue?._sum.totalAmount ?? 0, currency)}
                      </td>
                      <td className="py-2 pr-4 font-semibold">
                        {formatPrice(split?._sum.commissionAmount ?? 0, currency)}
                      </td>
                      <td className="py-2">
                        {formatPrice(split?._sum.sellerAmount ?? 0, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dernières commandes payées</h2>
            <Link
              href="/admin/commandes"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              Tout voir
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aucune commande payée.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{order.number}</p>
                    <p className="text-xs text-slate-500">
                      {order.buyerEmail}
                      {order.paidAt ? ` · ${formatDate(order.paidAt)}` : ""}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatPrice(order.totalAmount, order.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">À traiter</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span>Nouveaux messages de contact</span>
              <Link
                href="/admin/messages?statut=NEW"
                className="rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-800"
              >
                {newMessages}
              </Link>
            </li>
            <li className="flex items-center justify-between">
              <span>Bannières locales : vues / clics</span>
              <Link
                href="/admin/publicites"
                className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700"
              >
                {adStats._sum.impressions ?? 0} / {adStats._sum.clicks ?? 0}
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
    }
