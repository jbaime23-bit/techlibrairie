// src/lib/monthly-report.ts
// Rapport mensuel d'activité : calcul, email aux administrateurs et envoi automatique.
//
// Règles de calcul (les mêmes que les statistiques) :
// - les ventes sont les commandes PAYÉES et non remboursées, à leur date de paiement, en FCFA ;
// - les remboursements sont comptés le mois où ils ont lieu ;
// - les mois sont délimités en heure UTC (équivalent de l'heure du Burkina Faso).
//
// L'envoi automatique est consigné dans le journal (action "rapport.mensuel_envoye" ou
// "rapport.mensuel_vide", cible = mois "AAAA-MM") : un mois n'est jamais envoyé deux fois.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  getEmailAppUrl,
  isEmailConfigured,
  sendEmail,
  type EmailItem,
  type SendResult,
} from "@/lib/email";
import { formatPrice } from "@/lib/utils";

const MIN_YEAR = 2020;
const MAX_ADMIN_RECIPIENTS = 5;

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

// ---------------------------------------------------------------------------
// Mois
// ---------------------------------------------------------------------------

export interface MonthRef {
  year: number;
  // 1 à 12
  month: number;
  // Au format AAAA-MM
  key: string;
  start: Date;
  // Début du mois suivant (borne exclue)
  end: Date;
  label: string;
}

export function monthRef(year: number, month: number): MonthRef {
  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, "0")}`,
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
    label: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

export function currentMonth(now: Date = new Date()): MonthRef {
  return monthRef(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

function monthBefore(ref: MonthRef): MonthRef {
  return ref.month === 1 ? monthRef(ref.year - 1, 12) : monthRef(ref.year, ref.month - 1);
}

export function previousMonth(now: Date = new Date()): MonthRef {
  return monthBefore(currentMonth(now));
}

/** Mois demandé "AAAA-MM", ou null s'il est invalide, antérieur à 2020 ou dans le futur. */
export function parseMonthKey(raw: string | undefined, now: Date = new Date()): MonthRef | null {
  if (!raw) return null;

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw);
  if (!match) return null;

  const ref = monthRef(Number(match[1]), Number(match[2]));
  if (ref.year < MIN_YEAR) return null;
  if (ref.start.getTime() > now.getTime()) return null;

  return ref;
}

/** Les derniers mois, du plus récent (le mois en cours) au plus ancien. */
export function recentMonths(count: number, now: Date = new Date()): MonthRef[] {
  const result: MonthRef[] = [];
  let ref = currentMonth(now);

  for (let index = 0; index < count && ref.year >= MIN_YEAR; index += 1) {
    result.push(ref);
    ref = monthBefore(ref);
  }

  return result;
}

/** Période AAAA-MM-JJ à utiliser pour l'export comptable d'un mois. */
export function exportRange(ref: MonthRef, now: Date = new Date()): { from: string; to: string } {
  const lastDay = ref.end.getTime() > now.getTime() ? now : new Date(ref.end.getTime() - 86_400_000);
  return {
    from: ref.start.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Calcul du rapport
// ---------------------------------------------------------------------------

export interface MonthTotals {
  orders: number;
  items: number;
  revenue: number;
  commission: number;
  sellerShare: number;
  discount: number;
}

export interface MonthlyReport {
  month: MonthRef;
  // Vrai pour le mois en cours (chiffres provisoires)
  isPartial: boolean;
  generatedAt: Date;
  totals: MonthTotals;
  previous: MonthTotals;
  previousLabel: string;
  averageBasket: number;
  otherCurrencySales: number;
  paymentsByMethod: { mobileMoney: number; card: number };
  refunds: { count: number; amountXof: number; otherCurrency: number };
  payouts: { paidCount: number; paidAmount: number; requestedCount: number; owedNow: number };
  support: { count: number; amount: number };
  newAccounts: { buyers: number; sellers: number };
  newProducts: number;
  newReviews: number;
  topProducts: { title: string; sales: number; revenue: number }[];
  topSellers: { name: string; sales: number; revenue: number; commission: number }[];
  topPromos: { code: string; uses: number; discount: number }[];
}

async function totalsFor(start: Date, end: Date): Promise<MonthTotals & { otherCurrency: number }> {
  const paidItems: Prisma.OrderItemWhereInput = {
    currency: "XOF",
    order: { status: "PAID", paidAt: { gte: start, lt: end } },
  };
  const paidOrders: Prisma.OrderWhereInput = {
    status: "PAID",
    currency: "XOF",
    paidAt: { gte: start, lt: end },
  };

  const [items, orders, discount, otherCurrency] = await Promise.all([
    prisma.orderItem.aggregate({
      where: paidItems,
      _count: { _all: true },
      _sum: { unitAmount: true, commissionAmount: true, sellerAmount: true },
    }),
    prisma.order.count({ where: paidOrders }),
    prisma.order.aggregate({ where: paidOrders, _sum: { discountAmount: true } }),
    prisma.orderItem.count({
      where: {
        currency: { not: "XOF" },
        order: { status: "PAID", paidAt: { gte: start, lt: end } },
      },
    }),
  ]);

  return {
    orders,
    items: items._count._all,
    revenue: items._sum.unitAmount ?? 0,
    commission: items._sum.commissionAmount ?? 0,
    sellerShare: items._sum.sellerAmount ?? 0,
    discount: discount._sum.discountAmount ?? 0,
    otherCurrency,
  };
}

/** Date d'un remboursement : celle enregistrée au moment du remboursement, à défaut la dernière mise à jour. */
function refundDate(payload: unknown, fallback: Date): Date {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    const refund = (payload as Record<string, unknown>).refund;
    if (typeof refund === "object" && refund !== null && !Array.isArray(refund)) {
      const at = (refund as Record<string, unknown>).at;
      if (typeof at === "string") {
        const parsed = new Date(at);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  return fallback;
}

export async function buildMonthlyReport(
  month: MonthRef,
  now: Date = new Date()
): Promise<MonthlyReport> {
  const { start, end } = month;
  const before = monthBefore(month);

  const [
    current,
    previous,
    methodGroups,
    refundedPayments,
    payoutsPaid,
    payoutsRequested,
    earnedAll,
    payoutsCommitted,
    supportPayments,
    newBuyers,
    newSellers,
    newProducts,
    newReviews,
    productGroups,
    sellerGroups,
    promoGroups,
  ] = await Promise.all([
    totalsFor(start, end),
    totalsFor(before.start, before.end),
    prisma.payment.groupBy({
      by: ["method"],
      where: {
        status: { in: ["SUCCEEDED", "REFUNDED"] },
        order: { paidAt: { gte: start, lt: end } },
      },
      _count: { _all: true },
    }),
    prisma.payment.findMany({
      where: { status: "REFUNDED", updatedAt: { gte: start } },
      take: 2000,
      select: { amount: true, currency: true, providerPayload: true, updatedAt: true },
    }),
    prisma.payout.aggregate({
      where: { status: "PAID", currency: "XOF", paidAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payout.count({ where: { requestedAt: { gte: start, lt: end } } }),
    prisma.orderItem.aggregate({
      where: { currency: "XOF", order: { status: "PAID" } },
      _sum: { sellerAmount: true },
    }),
    prisma.payout.aggregate({
      where: { currency: "XOF", status: { not: "FAILED" } },
      _sum: { amount: true },
    }),
    prisma.supportPayment.aggregate({
      where: { status: "SUCCEEDED", updatedAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { role: "BUYER", createdAt: { gte: start, lt: end } } }),
    prisma.user.count({ where: { role: "SELLER", createdAt: { gte: start, lt: end } } }),
    prisma.product.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.review.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.orderItem.groupBy({
      by: ["productTitle"],
      where: { currency: "XOF", order: { status: "PAID", paidAt: { gte: start, lt: end } } },
      _count: { _all: true },
      _sum: { unitAmount: true },
      orderBy: { _count: { _all: "desc" } },
      take: 5,
    }),
    prisma.orderItem.groupBy({
      by: ["sellerId"],
      where: { currency: "XOF", order: { status: "PAID", paidAt: { gte: start, lt: end } } },
      _count: { _all: true },
      _sum: { unitAmount: true, commissionAmount: true },
      orderBy: { _sum: { unitAmount: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["promoCode"],
      where: { status: "PAID", promoCode: { not: null }, paidAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { discountAmount: true },
      orderBy: { _count: { _all: "desc" } },
      take: 5,
    }),
  ]);

  // Filtrer les remboursements effectifs sur la période demandée
  let refundCount = 0;
  let refundAmountXof = 0;
  let refundOtherCurrency = 0;

  for (const p of refundedPayments) {
    const d = refundDate(p.providerPayload, p.updatedAt);
    if (d.getTime() >= start.getTime() && d.getTime() < end.getTime()) {
      if (p.currency === "XOF") {
        refundCount++;
        refundAmountXof += p.amount;
      } else {
        refundOtherCurrency++;
      }
    }
  }

  // Ventilation des types de paiements
  let mobileMoney = 0;
  let card = 0;
  for (const g of methodGroups) {
