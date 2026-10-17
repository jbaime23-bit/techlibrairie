// src/lib/accounting-export.ts
// Construction des rapports comptables (ventes, remboursements, versements, support).
// Les ventes sont placées à leur date de paiement ; les remboursements à leur date de remboursement.
// Aucune donnée personnelle d'acheteur (email, téléphone) n'est exportée.

import type { OrderStatus, PaymentMethod, PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYOUT_STATUS_LABELS, operatorLabel } from "@/lib/payouts";
import {
  MAX_EXPORT_ROWS,
  formatCsvDateTime,
  moneyCell,
  percentCell,
  type Cell,
  type DateRange,
} from "@/lib/csv";

export interface ExportTable {
  name: string;
  headers: string[];
  rows: Cell[][];
}

export class ExportTooLargeError extends Error {
  constructor() {
    super("Trop de lignes pour un seul export.");
    this.name = "ExportTooLargeError";
  }
}

export const ADMIN_REPORTS = ["ventes", "remboursements", "versements", "support"] as const;
export type AdminReport = (typeof ADMIN_REPORTS)[number];

export const SELLER_REPORTS = ["ventes", "versements"] as const;
export type SellerReport = (typeof SELLER_REPORTS)[number];

export function isAdminReport(value: string | null): value is AdminReport {
  return ADMIN_REPORTS.some((report) => report === value);
}

export function isSellerReport(value: string | null): value is SellerReport {
  return SELLER_REPORTS.some((report) => report === value);
}

const ORDER_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  PAID: "Payée",
  REFUNDED: "Remboursée",
};

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  STRIPE: "Stripe",
  CINETPAY: "CinetPay",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: "Carte",
  MOBILE_MONEY: "Mobile Money",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
};

const REFUND_METHOD_LABELS: Record<string, string> = {
  "stripe-api": "Stripe (automatique)",
  "stripe-dashboard": "Stripe (tableau de bord)",
  "stripe-deja-rembourse": "Stripe (déjà remboursé)",
  "manuel-mobile-money": "Mobile Money (manuel)",
  "manuel-cinetpay-carte": "Carte CinetPay (manuel)",
};

function ensureWithinLimit(count: number): void {
  if (count > MAX_EXPORT_ROWS) {
    throw new ExportTooLargeError();
  }
}

// ---------------------------------------------------------------------------
// Ventes (lignes de commandes payées, y compris celles remboursées ensuite)
// ---------------------------------------------------------------------------

async function loadSalesItems(range: DateRange, sellerId?: string) {
  const items = await prisma.orderItem.findMany({
    where: {
      ...(sellerId ? { sellerId } : {}),
      order: {
        status: { in: ["PAID", "REFUNDED"] },
        paidAt: { gte: range.start, lte: range.end },
      },
    },
    orderBy: [{ order: { paidAt: "asc" } }, { id: "asc" }],
    take: MAX_EXPORT_ROWS + 1,
    select: {
      productTitle: true,
      unitAmount: true,
      currency: true,
      commissionRateBps: true,
      commissionAmount: true,
      sellerAmount: true,
      order: { select: { number: true, status: true, paidAt: true } },
      seller: { select: { displayName: true } },
    },
  });

  ensureWithinLimit(items.length);
  return items;
}

async function adminSales(range: DateRange): Promise<ExportTable> {
  const items = await loadSalesItems(range);

  return {
    name: "ventes",
    headers: [
      "Date de paiement (UTC)",
      "Commande",
      "Ouvrage",
      "Vendeur",
      "Devise",
      "Prix",
      "Taux de commission (%)",
      "Commission de la boutique",
      "Part du vendeur",
      "Statut",
    ],
    rows: items.map((item) => [
      formatCsvDateTime(item.order.paidAt),
      item.order.number,
      item.productTitle,
      item.seller.displayName,
      item.currency,
      moneyCell(item.unitAmount, item.currency),
      percentCell(item.commissionRateBps),
      moneyCell(item.commissionAmount, item.currency),
      moneyCell(item.sellerAmount, item.currency),
      ORDER_STATUS_LABELS[item.order.status] ?? item.order.status,
    ]),
  };
}

async function sellerSales(range: DateRange, sellerId: string): Promise<ExportTable> {
  const items = await loadSalesItems(range, sellerId);

  return {
    name: "ventes",
    headers: [
      "Date de paiement (UTC)",
      "Commande",
      "Ouvrage",
      "Devise",
      "Prix",
      "Taux de commission (%)",
      "Commission de la boutique",
      "Vos gains",
      "Statut",
    ],
    rows: items.map((item) => [
      formatCsvDateTime(item.order.paidAt),
      item.order.number,
      item.productTitle,
      item.currency,
      moneyCell(item.unitAmount, item.currency),
      percentCell(item.commissionRateBps),
      moneyCell(item.commissionAmount, item.currency),
      moneyCell(item.sellerAmount, item.currency),
      ORDER_STATUS_LABELS[item.order.status] ?? item.order.status,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Remboursements
// ---------------------------------------------------------------------------

interface RefundDetails {
  at: Date | null;
  method: string | null;
  reference: string | null;
  reason: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRefundDetails(payload: unknown): RefundDetails {
  const empty: RefundDetails = { at: null, method: null, reference: null, reason: null };

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return empty;
  }

  const refund = (payload as Record<string, unknown>).refund;
  if (typeof refund !== "object" || refund === null || Array.isArray(refund)) {
    return empty;
  }

  const record = refund as Record<string, unknown>;
  const atRaw = readString(record.at);
  const at = atRaw ? new Date(atRaw) : null;

  return {
    at: at && !Number.isNaN(at.getTime()) ? at : null,
    method: readString(record.method),
    reference: readString(record.reference),
    reason: readString(record.reason),
  };
}

async function adminRefunds(range: DateRange): Promise<ExportTable> {
  const payments = await prisma.payment.findMany({
    where: { status: "REFUNDED", updatedAt: { gte: range.start } },
    orderBy: { updatedAt: "asc" },
    take: MAX_EXPORT_ROWS + 1,
    select: {
      amount: true,
      currency: true,
      provider: true,
      method: true,
      providerPayload: true,
      updatedAt: true,
      order: { select: { number: true } },
    },
  });

  ensureWithinLimit(payments.length);

  const rows: Cell[][] = [];

  for (const payment of payments) {
    const details = readRefundDetails(payment.providerPayload);
    const refundDate = details.at ?? payment.updatedAt;

    if (refundDate.getTime() < range.start.getTime() || refundDate.getTime() > range.end.getTime()) {
      continue;
    }

    rows.push([
      formatCsvDateTime(refundDate),
      payment.order.number,
      PROVIDER_LABELS[payment.provider],
      METHOD_LABELS[payment.method],
      payment.currency,
      moneyCell(payment.amount, payment.currency),
      details.method ? REFUND_METHOD_LABELS[details.method] ?? details.method : null,
      details.reference,
      details.reason,
    ]);
  }

  return {
    name: "remboursements",
    headers: [
      "Date du remboursement (UTC)",
      "Commande",
      "Prestataire",
      "Moyen de paiement",
      "Devise",
      "Montant remboursé",
      "Mode de remboursement",
      "Référence",
      "Motif",
    ],
    rows,
  };
}

// ---------------------------------------------------------------------------
// Versements aux vendeurs
// ---------------------------------------------------------------------------

async function loadPayouts(range: DateRange, sellerId?: string) {
  const payouts = await prisma.payout.findMany({
    where: {
      ...(sellerId ? { sellerId } : {}),
      OR: [
        { requestedAt: { gte: range.start, lte: range.end } },
        { paidAt: { gte: range.start, lte: range.end } },
      ],
    },
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    take: MAX_EXPORT_ROWS + 1,
    select: {
      amount: true,
      currency: true,
      status: true,
      method: true,
      reference: true,
      requestedAt: true,
      paidAt: true,
      seller: { select: { displayName: true } },
    },
  });

  ensureWithinLimit(payouts.length);
  return payouts;
}

async function adminPayouts(range: DateRange): Promise<ExportTable> {
  const payouts = await loadPayouts(range);

  return {
    name: "versements",
    headers: [
      "Date de la demande (UTC)",
      "Date du versement (UTC)",
      "Vendeur",
      "Devise",
      "Montant",
      "Statut",
      "Opérateur",
      "Référence",
    ],
    rows: payouts.map((payout) => [
      formatCsvDateTime(payout.requestedAt),
      formatCsvDateTime(payout.paidAt),
      payout.seller.displayName,
      payout.currency,
      moneyCell(payout.amount, payout.currency),
      PAYOUT_STATUS_LABELS[payout.status],
      operatorLabel(payout.method),
      payout.reference,
    ]),
  };
}

async function sellerPayouts(range: DateRange, sellerId: string): Promise<ExportTable> {
  const payouts = await loadPayouts(range, sellerId);

  return {
    name: "versements",
    headers: [
      "Date de la demande (UTC)",
      "Date du versement (UTC)",
      "Devise",
      "Montant",
      "Statut",
      "Opérateur",
      "Référence",
    ],
    rows: payouts.map((payout) => [
      formatCsvDateTime(payout.requestedAt),
      formatCsvDateTime(payout.paidAt),
      payout.currency,
      moneyCell(payout.amount, payout.currency),
      PAYOUT_STATUS_LABELS[payout.status],
      operatorLabel(payout.method),
      payout.reference,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Support payant
// ---------------------------------------------------------------------------

async function adminSupport(range: DateRange): Promise<ExportTable> {
  const payments = await prisma.supportPayment.findMany({
    where: {
      status: "SUCCEEDED",
      updatedAt: { gte: range.start, lte: range.end },
    },
    orderBy: { updatedAt: "asc" },
    take: MAX_EXPORT_ROWS + 1,
    select: {
      amount: true,
      currency: true,
      provider: true,
      method: true,
      providerReference: true,
      updatedAt: true,
      thread: { select: { number: true } },
    },
  });

  ensureWithinLimit(payments.length);

  return {
    name: "support",
    headers: [
      "Date du paiement (UTC)",
      "Conversation",
      "Prestataire",
      "Moyen de paiement",
      "Devise",
      "Montant",
      "Référence de la transaction",
    ],
    rows: payments.map((payment) => [
      formatCsvDateTime(payment.updatedAt),
      payment.thread.number,
      PROVIDER_LABELS[payment.provider],
      METHOD_LABELS[payment.method],
      payment.currency,
      moneyCell(payment.amount, payment.currency),
      payment.providerReference,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Points d'entrée
// ---------------------------------------------------------------------------

export function buildAdminReport(type: AdminReport, range: DateRange): Promise<ExportTable> {
  switch (type) {
    case "ventes":
      return adminSales(range);
    case "remboursements":
      return adminRefunds(range);
    case "versements":
      return adminPayouts(range);
    case "support":
      return adminSupport(range);
  }
}

export function buildSellerReport(
  type: SellerReport,
  range: DateRange,
  sellerId: string
): Promise<ExportTable> {
  return type === "ventes" ? sellerSales(range, sellerId) : sellerPayouts(range, sellerId);
  }
