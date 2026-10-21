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
    // Ventilation des types de paiements
  let mobileMoney = 0;
  let card = 0;
  for (const g of methodGroups) {
    if (g.method === "MOBILE_MONEY") mobileMoney = g._count._all;
    if (g.method === "CARD") card = g._count._all;
  }

  // Vendeurs : Récupérer les noms correspondants aux IDs groupés
  const sellerIds = sellerGroups.map((g) => g.sellerId).filter((id): id is string => !!id);
  const sellersProfiles = await prisma.user.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, name: true },
  });
  const sellerNameMap = new Map(sellersProfiles.map((p) => [p.id, p.name || "Inconnu"]));

  return {
    month,
    isPartial: end.getTime() > now.getTime(),
    generatedAt: now,
    totals: current,
    previous,
    previousLabel: before.label,
    averageBasket: current.orders > 0 ? Math.round(current.revenue / current.orders) : 0,
    otherCurrencySales: current.otherCurrency,
    paymentsByMethod: { mobileMoney, card },
    refunds: { count: refundCount, amountXof: refundAmountXof, otherCurrency: refundOtherCurrency },
    payouts: {
      paidCount: payoutsPaid._count._all,
      paidAmount: payoutsPaid._sum.amount ?? 0,
      requestedCount: payoutsRequested,
      owedNow: (earnedAll._sum.sellerAmount ?? 0) - (payoutsCommitted._sum.amount ?? 0),
    },
    support: {
      count: supportPayments._count._all,
      amount: supportPayments._sum.amount ?? 0,
    },
    newAccounts: { buyers: newBuyers, sellers: newSellers },
    newProducts,
    newReviews,
    topProducts: productGroups.map((g) => ({
      title: g.productTitle || "Sans titre",
      sales: g._count._all,
      revenue: g._sum.unitAmount ?? 0,
    })),
    topSellers: sellerGroups.map((g) => ({
      name: sellerNameMap.get(g.sellerId || "") || "Inconnu",
      sales: g._count._all,
      revenue: g._sum.unitAmount ?? 0,
      commission: g._sum.commissionAmount ?? 0,
    })),
    topPromos: promoGroups.map((g) => ({
      code: g.promoCode || "",
      uses: g._count._all,
      discount: g._sum.discountAmount ?? 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Envoi automatique et notifications aux administrateurs
// ---------------------------------------------------------------------------

export async function sendMonthlyReportEmail(report: MonthlyReport): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { success: false, error: "Configuration email manquante." };
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    take: MAX_ADMIN_RECIPIENTS,
    select: { email: true },
  });

  if (admins.length === 0) {
    return { success: false, error: "Aucun administrateur actif trouvé." };
  }

  const appUrl = getEmailAppUrl();
  const subject = `[Rapport Mensuel] ${report.month.label.toUpperCase()}`;
  
  const html = `
    <h2>Rapport mensuel d'activité - ${report.month.label}</h2>
    <p>Généré le : ${report.generatedAt.toLocaleDateString()}</p>
    <hr />
    <h3>Chiffres clés (XOF)</h3>
    <ul>
      <li><b>Commandes payées :</b> ${report.totals.orders} (Panier moyen : ${formatPrice(report.averageBasket)})</li>
      <li><b>Revenu total :</b> ${formatPrice(report.totals.revenue)}</li>
      <li><b>Commission plateforme :</b> ${formatPrice(report.totals.commission)}</li>
      <li><b>Part vendeurs :</b> ${formatPrice(report.totals.sellerShare)}</li>
      <li><b>Codes Promos appliqués :</b> ${formatPrice(report.totals.discount)}</li>
    </ul>
    <h3>Remboursements et Litiges</h3>
    <ul>
      <li><b>Remboursements XOF :</b> ${report.refunds.count} effectuant un total de ${formatPrice(report.refunds.amountXof)}</li>
      <li><b>Support tickets résolus :</b> ${report.support.count} (${formatPrice(report.support.amount)})</li>
    </ul>
    <p><a href="${appUrl}/admin/reports/${report.month.key}">Cliquez ici pour voir le rapport détaillé sur la plateforme</a></p>
  `;

  const recipients = admins.map((a) => a.email).filter((email): email is string => !!email);
  
  const emailItem: EmailItem = {
    to: recipients,
    subject,
    html,
  };

  return sendEmail(emailItem);
}

/** Tâche automatisée : génère et envoie le rapport du mois précédent s'il n'a pas déjà été traité */
export async function cronSendPreviousMonthReport(now: Date = new Date()): Promise<void> {
  const targetMonth = previousMonth(now);

  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      action: { in: ["rapport.mensuel_envoye", "rapport.mensuel_vide"] },
      target: targetMonth.key,
    },
  });

  if (existingAudit) return;

  const report = await buildMonthlyReport(targetMonth, now);

  if (report.totals.orders === 0 && report.refunds.count === 0) {
    await recordAudit({
      action: "rapport.mensuel_vide",
      target: targetMonth.key,
      details: { message: "Aucune activité enregistrée sur ce mois." },
    });
    return;
  }

  const result = await sendMonthlyReportEmail(report);

  if (result.success) {
    await recordAudit({
      action: "rapport.mensuel_envoye",
      target: targetMonth.key,
      details: { recipientsCount: report.totals.orders },
    });
  } else {
    throw new Error(`Échec de l'envoi automatique du rapport : ${result.error}`);
  }
    }
