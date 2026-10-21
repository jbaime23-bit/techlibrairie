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

  const paidItems: Prisma.OrderItemWhereInput = {
    currency: "XOF",
    order: { status: "PAID", paidAt: { gte: start, lt: end } },
  };

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
      _sum: { baseAmountXof: true },
    }),
    prisma.user.count({ where: { role: "BUYER", createdAt: { gte: start, lt: end } } }),
    prisma.user.count({ where: { role: "SELLER", createdAt: { gte: start, lt: end } } }),
    prisma.product.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.review.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: paidItems,
      _sum: { unitAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { unitAmount: "desc" } },
      take: 5,
    }),
    prisma.orderItem.groupBy({
      by: ["sellerId"],
      where: paidItems,
      _sum: { unitAmount: true, commissionAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { unitAmount: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["promoCodeId"],
      where: {
        status: "PAID",
        promoCodeId: { not: null },
        paidAt: { gte: start, lt: end },
      },
      _count: { _all: true },
      _sum: { discountAmount: true },
      orderBy: { _sum: { discountAmount: "desc" } },
      take: 5,
    }),
  ]);

  const [products, sellers, promos] = await Promise.all([
    productGroups.length
      ? prisma.product.findMany({
          where: { id: { in: productGroups.map((group) => group.productId) } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    sellerGroups.length
      ? prisma.sellerProfile.findMany({
          where: { id: { in: sellerGroups.map((group) => group.sellerId) } },
          select: { id: true, displayName: true },
        })
      : Promise.resolve([]),
    promoGroups.length
      ? prisma.promoCode.findMany({
          where: {
            id: {
              in: promoGroups
                .map((group) => group.promoCodeId)
                .filter((id): id is string => id !== null),
            },
          },
          select: { id: true, code: true },
        })
      : Promise.resolve([]),
  ]);

  const titleById = new Map(products.map((product) => [product.id, product.title]));
  const nameById = new Map(sellers.map((seller) => [seller.id, seller.displayName]));
  const codeById = new Map(promos.map((promo) => [promo.id, promo.code]));

  // Remboursements du mois (date de remboursement, pas date de la vente).
  let refundCount = 0;
  let refundAmountXof = 0;
  let refundOtherCurrency = 0;
  for (const payment of refundedPayments) {
    const date = refundDate(payment.providerPayload, payment.updatedAt);
    if (date.getTime() < start.getTime() || date.getTime() >= end.getTime()) continue;

    refundCount += 1;
    if (payment.currency === "XOF") {
      refundAmountXof += payment.amount;
    } else {
      refundOtherCurrency += 1;
    }
  }

  const cardPayments = methodGroups
    .filter((group) => group.method === "CARD")
    .reduce((sum, group) => sum + group._count._all, 0);
  const allPayments = methodGroups.reduce((sum, group) => sum + group._count._all, 0);

  const owedNow = Math.max(
    0,
    (earnedAll._sum.sellerAmount ?? 0) - (payoutsCommitted._sum.amount ?? 0)
  );

  return {
    month,
    isPartial: end.getTime() > now.getTime(),
    generatedAt: now,
    totals: {
      orders: current.orders,
      items: current.items,
      revenue: current.revenue,
      commission: current.commission,
      sellerShare: current.sellerShare,
      discount: current.discount,
    },
    previous: {
      orders: previous.orders,
      items: previous.items,
      revenue: previous.revenue,
      commission: previous.commission,
      sellerShare: previous.sellerShare,
      discount: previous.discount,
    },
    previousLabel: before.label,
    averageBasket: current.orders > 0 ? Math.round(current.revenue / current.orders) : 0,
    otherCurrencySales: current.otherCurrency,
    paymentsByMethod: { mobileMoney: allPayments - cardPayments, card: cardPayments },
    refunds: {
      count: refundCount,
      amountXof: refundAmountXof,
      otherCurrency: refundOtherCurrency,
    },
    payouts: {
      paidCount: payoutsPaid._count._all,
      paidAmount: payoutsPaid._sum.amount ?? 0,
      requestedCount: payoutsRequested,
      owedNow,
    },
    support: {
      count: supportPayments._count._all,
      amount: supportPayments._sum.baseAmountXof ?? 0,
    },
    newAccounts: { buyers: newBuyers, sellers: newSellers },
    newProducts,
    newReviews,
    topProducts: productGroups.map((group) => ({
      title: titleById.get(group.productId) ?? "Ouvrage",
      sales: group._count._all,
      revenue: group._sum.unitAmount ?? 0,
    })),
    topSellers: sellerGroups.map((group) => ({
      name: nameById.get(group.sellerId) ?? "Vendeur",
      sales: group._count._all,
      revenue: group._sum.unitAmount ?? 0,
      commission: group._sum.commissionAmount ?? 0,
    })),
    topPromos: promoGroups
      .filter((group) => group.promoCodeId !== null)
      .map((group) => ({
        code: codeById.get(group.promoCodeId as string) ?? "(code supprimé)",
        uses: group._count._all,
        discount: group._sum.discountAmount ?? 0,
      })),
  };
}

/** Évolution par rapport au mois précédent, ex. "+12 %" ; null si la comparaison n'a pas de sens. */
export function variationLabel(current: number, previous: number): string | null {
  if (previous <= 0) return current > 0 ? "nouveau" : null;

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return "stable";
  return `${percent > 0 ? "+" : ""}${percent} %`;
}

/** Vrai si le mois ne contient aucune activité à rapporter. */
export function isReportEmpty(report: MonthlyReport): boolean {
  return (
    report.totals.orders === 0 &&
    report.otherCurrencySales === 0 &&
    report.refunds.count === 0 &&
    report.payouts.paidCount === 0 &&
    report.payouts.requestedCount === 0 &&
    report.support.count === 0 &&
    report.newAccounts.buyers === 0 &&
    report.newAccounts.sellers === 0 &&
    report.newProducts === 0 &&
    report.newReviews === 0
  );
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** Envoie le rapport par email à une adresse. */
export async function sendReportEmail(
  report: MonthlyReport,
  to: string,
  idempotencyKey: string
): Promise<SendResult> {
  const appUrl = getEmailAppUrl();
  if (!appUrl || !isEmailConfigured()) {
    return { ok: false, error: "Envoi d'emails indisponible (configuration manquante)." };
  }

  const { totals, previous } = report;
  const range = exportRange(report.month, report.generatedAt);

  const commissionVariation = variationLabel(totals.commission, previous.commission);
  const revenueVariation = variationLabel(totals.revenue, previous.revenue);

  const items: EmailItem[] = [
    {
      label: "Commandes payées",
      detail: `${totals.orders} commande${totals.orders > 1 ? "s" : ""}, ${totals.items} ouvrage${totals.items > 1 ? "s" : ""} vendu${totals.items > 1 ? "s" : ""}`,
    },
    {
      label: "Chiffre d'affaires",
      detail: `${formatPrice(totals.revenue, "XOF")}${revenueVariation ? ` (${revenueVariation} par rapport à ${report.previousLabel})` : ""}`,
    },
    {
      label: "Commission de la boutique",
      detail: `${formatPrice(totals.commission, "XOF")}${commissionVariation ? ` (${commissionVariation})` : ""}`,
    },
    { label: "Part des vendeurs", detail: formatPrice(totals.sellerShare, "XOF") },
    { label: "Remises accordées (codes promotionnels)", detail: formatPrice(totals.discount, "XOF") },
    { label: "Panier moyen", detail: formatPrice(report.averageBasket, "XOF") },
    {
      label: "Paiements reçus",
      detail: `${report.paymentsByMethod.mobileMoney} par Mobile Money, ${report.paymentsByMethod.card} par carte`,
    },
    {
      label: "Remboursements du mois",
      detail: `${report.refunds.count} (${formatPrice(report.refunds.amountXof, "XOF")}${report.refunds.otherCurrency > 0 ? `, plus ${report.refunds.otherCurrency} en devise étrangère non totalisé${report.refunds.otherCurrency > 1 ? "s" : ""}` : ""})`,
    },
    {
      label: "Support payant",
      detail: `${report.support.count} conversation${report.support.count > 1 ? "s" : ""}, ${formatPrice(report.support.amount, "XOF")}`,
    },
    {
      label: "Versements effectués aux vendeurs",
      detail: `${report.payouts.paidCount} (${formatPrice(report.payouts.paidAmount, "XOF")})`,
    },
    {
      label: "Reste dû aux vendeurs (au jour de l'envoi)",
      detail: formatPrice(report.payouts.owedNow, "XOF"),
    },
    {
      label: "Nouveaux comptes",
      detail: `${report.newAccounts.buyers} acheteur${report.newAccounts.buyers > 1 ? "s" : ""}, ${report.newAccounts.sellers} vendeur${report.newAccounts.sellers > 1 ? "s" : ""}`,
    },
    {
      label: "Ouvrages publiés et avis reçus",
      detail: `${report.newProducts} ouvrage${report.newProducts > 1 ? "s" : ""}, ${report.newReviews} avis`,
    },
  ];

  for (const [index, product] of report.topProducts.slice(0, 3).entries()) {
    items.push({
      label: `Meilleur ouvrage n°${index + 1} : ${product.title}`,
      detail: `${product.sales} vente${product.sales > 1 ? "s" : ""}, ${formatPrice(product.revenue, "XOF")}`,
    });
  }

  const paragraphs = [
    `Voici le récapitulatif de l'activité de TechLibrairie pour ${report.month.label}.`,
    "Les ventes comptent les commandes payées et non remboursées, à leur date de paiement, en FCFA (jours en heure UTC, équivalente à l'heure du Burkina Faso). Les remboursements sont comptés le mois où ils ont lieu.",
  ];

  if (report.isPartial) {
    paragraphs.push("Ce mois n'est pas terminé : les chiffres sont provisoires.");
  }
  if (report.otherCurrencySales > 0) {
    paragraphs.push(
      `${report.otherCurrencySales} vente${report.otherCurrencySales > 1 ? "s" : ""} en devise étrangère ne ${report.otherCurrencySales > 1 ? "sont" : "est"} pas comptée${report.otherCurrencySales > 1 ? "s" : ""} dans les totaux en FCFA.`
    );
  }

  return sendEmail({
    to,
    subject: `Rapport TechLibrairie : ${report.month.label}`,
    idempotencyKey,
    content: {
      title: `Rapport de ${report.month.label}`,
      paragraphs,
      items,
      button: {
        label: "Voir le rapport complet",
        url: `${appUrl}/admin/rapports?mois=${report.month.key}`,
      },
      note: `Export comptable de cette période : ${appUrl}/admin/export?du=${range.from}&au=${range.to}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Envoi automatique
// ---------------------------------------------------------------------------

export type MonthlyReportStatus =
  | "deja-traite"
  | "envoye"
  | "mois-vide"
  | "email-indisponible"
  | "aucun-destinataire"
  | "echec";

export interface MonthlyReportOutcome {
  status: MonthlyReportStatus;
  month: string;
  sent: number;
}

const REPORT_ACTIONS = ["rapport.mensuel_envoye", "rapport.mensuel_vide"];

/**
 * Envoie le rapport du mois précédent aux administrateurs s'il n'a pas déjà été traité.
 * Appelée chaque jour par la tâche planifiée : sans effet les autres jours.
 */
export async function sendMonthlyReportIfDue(
  now: Date = new Date()
): Promise<MonthlyReportOutcome> {
  const month = previousMonth(now);

  const alreadyDone = await prisma.auditLog.findFirst({
    where: {
      action: { in: REPORT_ACTIONS },
      targetType: "rapport",
      targetId: month.key,
    },
    select: { id: true },
  });

  if (alreadyDone) return { status: "deja-traite", month: month.key, sent: 0 };

  if (!isEmailConfigured() || !getEmailAppUrl()) {
    return { status: "email-indisponible", month: month.key, sent: 0 };
  }

  const report = await buildMonthlyReport(month, now);

  if (isReportEmpty(report)) {
    await recordAudit({
      adminId: null,
      adminEmail: "systeme",
      action: "rapport.mensuel_vide",
      targetType: "rapport",
      targetId: month.key,
    });
    return { status: "mois-vide", month: month.key, sent: 0 };
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    take: MAX_ADMIN_RECIPIENTS,
    select: { id: true, email: true },
  });

  if (admins.length === 0) return { status: "aucun-destinataire", month: month.key, sent: 0 };

  let sent = 0;
  for (const admin of admins) {
    const result = await sendReportEmail(
      report,
      admin.email,
      `monthly-report-${month.key}-${admin.id}`
    );
    if (result.ok) sent += 1;
  }

  // Si aucun email n'a pu partir, rien n'est consigné : nouvelle tentative le lendemain.
  if (sent === 0) return { status: "echec", month: month.key, sent: 0 };

  await recordAudit({
    adminId: null,
    adminEmail: "systeme",
    action: "rapport.mensuel_envoye",
    targetType: "rapport",
    targetId: month.key,
    details: {
      destinataires: sent,
      commandes: report.totals.orders,
      chiffre_affaires_fcfa: report.totals.revenue,
    },
  });

  return { status: "envoye", month: month.key, sent };
}
