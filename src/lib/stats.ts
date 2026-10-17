// src/lib/stats.ts
// Statistiques de ventes : séries journalières, totaux, meilleurs ouvrages et vendeurs.
// Seules les commandes PAYÉES comptent (ni remboursées, ni annulées), à la date du paiement,
// en FCFA uniquement. Les jours s'arrêtent à minuit UTC (équivalent de l'heure du Burkina Faso).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const STATS_PERIODS = [7, 30, 90] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/** Période demandée dans l'adresse (30 jours par défaut). */
export function parsePeriod(value: string | string[] | undefined): StatsPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return STATS_PERIODS.find((period) => period === parsed) ?? 30;
}

export interface DailyPoint {
  // Date au format AAAA-MM-JJ
  date: string;
  orders: number;
  revenue: number;
  commission: number;
  seller: number;
}

export interface TopProduct {
  productId: string;
  title: string;
  sales: number;
  revenue: number;
  seller: number;
}

export interface TopSeller {
  sellerId: string;
  name: string;
  sales: number;
  revenue: number;
  commission: number;
}

export interface SalesStats {
  days: number;
  series: DailyPoint[];
  totals: {
    orders: number;
    items: number;
    revenue: number;
    commission: number;
    seller: number;
  };
  topProducts: TopProduct[];
  topSellers: TopSeller[];
  otherCurrencySales: number;
}

interface DailyRow {
  day: Date;
  orders: number;
  revenue: number;
  commission: number;
  seller: number;
}

function periodStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

/** Libellé court d'un jour, ex. "2026-10-12" devient "12/10". */
export function shortDateLabel(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

/** Calcule les statistiques de ventes de la période, pour toute la boutique ou pour un vendeur. */
export async function getSalesStats(options: {
  days: StatsPeriod;
  sellerId?: string;
}): Promise<SalesStats> {
  const start = periodStart(options.days);

  const sellerFilterSql = options.sellerId
    ? Prisma.sql`AND i."sellerId" = ${options.sellerId}`
    : Prisma.empty;

  const itemWhere: Prisma.OrderItemWhereInput = {
    currency: "XOF",
    order: { status: "PAID", paidAt: { gte: start } },
    ...(options.sellerId ? { sellerId: options.sellerId } : {}),
  };

  const [rows, itemsCount, productGroups, sellerGroups, otherCurrencySales] =
    await Promise.all([
      prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT
          date_trunc('day', o."paidAt") AS day,
          COUNT(DISTINCT o."id")::int AS orders,
          COALESCE(SUM(i."unitAmount"), 0)::float8 AS revenue,
          COALESCE(SUM(i."commissionAmount"), 0)::float8 AS commission,
          COALESCE(SUM(i."sellerAmount"), 0)::float8 AS seller
        FROM "OrderItem" i
        INNER JOIN "Order" o ON o."id" = i."orderId"
        WHERE o."status" = 'PAID'
          AND o."paidAt" >= ${start}
          AND i."currency" = 'XOF'
          ${sellerFilterSql}
        GROUP BY 1
        ORDER BY 1
      `),
      prisma.orderItem.count({ where: itemWhere }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: itemWhere,
        _sum: { unitAmount: true, sellerAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { unitAmount: "desc" } },
        take: 5,
      }),
      options.sellerId
        ? Promise.resolve(null)
        : prisma.orderItem.groupBy({
            by: ["sellerId"],
            where: itemWhere,
            _sum: { unitAmount: true, commissionAmount: true },
            _count: { _all: true },
            orderBy: { _sum: { unitAmount: "desc" } },
            take: 5,
          }),
      prisma.orderItem.count({
        where: {
          currency: { not: "XOF" },
          order: { status: "PAID", paidAt: { gte: start } },
          ...(options.sellerId ? { sellerId: options.sellerId } : {}),
        },
      }),
    ]);

  // Série complète : un point par jour, y compris les jours sans vente.
  const byDay = new Map<string, DailyRow>();
  for (const row of rows) {
    byDay.set(new Date(row.day).toISOString().slice(0, 10), row);
  }

  const series: DailyPoint[] = [];
  for (let index = 0; index < options.days; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);

    series.push({
      date: key,
      orders: row ? Number(row.orders) : 0,
      revenue: row ? Number(row.revenue) : 0,
      commission: row ? Number(row.commission) : 0,
      seller: row ? Number(row.seller) : 0,
    });
  }

  const totals = series.reduce(
    (sum, point) => ({
      orders: sum.orders + point.orders,
      items: sum.items,
      revenue: sum.revenue + point.revenue,
      commission: sum.commission + point.commission,
      seller: sum.seller + point.seller,
    }),
    { orders: 0, items: itemsCount, revenue: 0, commission: 0, seller: 0 }
  );

  const products = productGroups.length
    ? await prisma.product.findMany({
        where: { id: { in: productGroups.map((group) => group.productId) } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(products.map((product) => [product.id, product.title]));

  const topProducts: TopProduct[] = productGroups.map((group) => ({
    productId: group.productId,
    title: titleById.get(group.productId) ?? "Ouvrage",
    sales: group._count._all,
    revenue: group._sum.unitAmount ?? 0,
    seller: group._sum.sellerAmount ?? 0,
  }));

  let topSellers: TopSeller[] = [];
  if (sellerGroups && sellerGroups.length > 0) {
    const sellers = await prisma.sellerProfile.findMany({
      where: { id: { in: sellerGroups.map((group) => group.sellerId) } },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(sellers.map((seller) => [seller.id, seller.displayName]));

    topSellers = sellerGroups.map((group) => ({
      sellerId: group.sellerId,
      name: nameById.get(group.sellerId) ?? "Vendeur",
      sales: group._count._all,
      revenue: group._sum.unitAmount ?? 0,
      commission: group._sum.commissionAmount ?? 0,
    }));
  }

  return {
    days: options.days,
    series,
    totals,
    topProducts,
    topSellers,
    otherCurrencySales,
  };
}
