// src/app/admin/vendeurs/page.tsx
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import {
  setSellerCommissionAction,
  setSellerStatusAction,
} from "@/app/admin/actions";
import { getDefaultCommissionRateBps } from "@/lib/commission";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Vendeurs",
};

export const dynamic = "force-dynamic";

export default async function AdminVendeursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/vendeurs");

  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);

  const where: Prisma.SellerProfileWhereInput = q
    ? {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const total = await prisma.sellerProfile.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const [sellers, defaultRateBps] = await Promise.all([
    prisma.sellerProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        user: { select: { email: true, name: true } },
        _count: { select: { products: true } },
      },
    }),
    getDefaultCommissionRateBps(),
  ]);

  const stats = await prisma.orderItem.groupBy({
    by: ["sellerId", "currency"],
    where: {
      sellerId: { in: sellers.map((seller) => seller.id) },
      order: { status: "PAID" },
    },
    _sum: { sellerAmount: true },
    _count: { _all: true },
  });

  const salesBySeller = new Map<string, { count: number; earnings: string[] }>();
  for (const row of stats) {
    const entry = salesBySeller.get(row.sellerId) ?? { count: 0, earnings: [] };
    entry.count += row._count._all;
    entry.earnings.push(formatPrice(row._sum.sellerAmount ?? 0, row.currency));
    salesBySeller.set(row.sellerId, entry);
  }

  const defaultPercent = defaultRateBps / 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Vendeurs</h1>
        <p className="text-sm text-slate-600">
          Commission par défaut de la boutique : {defaultPercent} %
        </p>
      </div>

      <form method="get" action="/admin/vendeurs" className="flex flex-wrap gap-3">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom ou email du vendeur"
          className="input max-w-xs"
        />
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      <p className="text-sm text-slate-600">
        {total} vendeur{total > 1 ? "s" : ""}
      </p>

      {sellers.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucun vendeur trouvé.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Vendeur</th>
                <th className="px-4 py-3 font-medium">Produits</th>
                <th className="px-4 py-3 font-medium">Ventes</th>
                <th className="px-4 py-3 font-medium">Revenus vendeur</th>
                <th className="px-4 py-3 font-medium">Commission (%)</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => {
                const sales = salesBySeller.get(seller.id);
                const isActive = seller.status === "ACTIVE";

                return (
                  <tr key={seller.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{seller.displayName}</p>
                      <p className="text-xs text-slate-500">{seller.user.email}</p>
                      <p className="text-xs text-slate-400">
                        Inscrit le {formatDate(seller.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">{seller._count.products}</td>
                    <td className="px-4 py-3">{sales?.count ?? 0}</td>
                    <td className="px-4 py-3">
                      {sales && sales.earnings.length > 0
                        ? sales.earnings.map((line) => <p key={line}>{line}</p>)
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={setSellerCommissionAction}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="sellerId" value={seller.id} />
                        <input
                          name="commissionPercent"
                          type="number"
                          min="0"
                          max="90"
                          step="0.01"
                          defaultValue={
                            seller.commissionRateBps !== null
                              ? seller.commissionRateBps / 100
                              : ""
                          }
                          placeholder={String(defaultPercent)}
                          aria-label={`Commission de ${seller.displayName}`}
                          className="input w-20 px-2 py-1 text-xs"
                        />
                        <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                          OK
                        </button>
                      </form>
                      <p className="mt-1 text-xs text-slate-400">
                        Vide = taux par défaut
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`mb-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                          isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {isActive ? "Actif" : "Suspendu"}
                      </span>
                      <form action={setSellerStatusAction}>
                        <input type="hidden" name="sellerId" value={seller.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={isActive ? "SUSPENDED" : "ACTIVE"}
                        />
                        <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                          {isActive ? "Suspendre" : "Réactiver"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/vendeurs"
        params={{ q: q || undefined }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
