// src/lib/payouts.ts
// Versements aux vendeurs : solde, libellés et outils de validation.
// Les versements se font en FCFA (XOF) ; les prix sont fixés en FCFA depuis l'étape 12.

import type { PayoutStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Délai avant que les gains d'une commande puissent être retirés.
export const PAYOUT_HOLD_DAYS = 3;

export const PAYOUT_OPERATORS = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MOOV_MONEY", label: "Moov Money" },
] as const;

export type PayoutOperator = (typeof PAYOUT_OPERATORS)[number]["value"];

export function isPayoutOperator(value: string): value is PayoutOperator {
  return PAYOUT_OPERATORS.some((operator) => operator.value === value);
}

export function operatorLabel(value: string | null | undefined): string {
  return PAYOUT_OPERATORS.find((operator) => operator.value === value)?.label ?? "-";
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours de traitement",
  PAID: "Versé",
  FAILED: "Refusé ou annulé",
};

export const PAYOUT_STATUS_STYLES: Record<PayoutStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-brand-100 text-brand-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-slate-100 text-slate-700",
};

/**
 * Normalise un numéro de téléphone en chiffres avec indicatif pays.
 * Un numéro de 8 chiffres est considéré comme un numéro burkinabè (indicatif 226).
 * Renvoie null si le numéro est invalide.
 */
export function normalizeMobileNumber(raw: string): string | null {
  let digits = raw.replace(/[\s().-]/g, "");

  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `226${digits}`;

  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Affiche un numéro, ex. 22670123456 devient "+226 70 12 34 56". */
export function formatMobileNumber(digits: string): string {
  if (digits.startsWith("226") && digits.length === 11) {
    const local = digits.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ");
    return `+226 ${local}`;
  }
  return `+${digits}`;
}

export interface SellerBalanceXof {
  // Total des gains (commandes payées)
  earned: number;
  // Gains retirables (commandes payées depuis plus de PAYOUT_HOLD_DAYS jours)
  released: number;
  // Gains encore en attente de déblocage
  onHold: number;
  // Déjà versé
  paid: number;
  // Demandes en cours (en attente ou en traitement)
  open: number;
  // Montant que le vendeur peut demander maintenant
  available: number;
}

/** Calcule le solde en FCFA d'un vendeur (utilisable dans une transaction). */
export async function getSellerBalanceXof(
  sellerId: string,
  client: Prisma.TransactionClient = prisma
): Promise<SellerBalanceXof> {
  const threshold = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);

  const earnedRow = await client.orderItem.aggregate({
    where: { sellerId, currency: "XOF", order: { status: "PAID" } },
    _sum: { sellerAmount: true },
  });

  const releasedRow = await client.orderItem.aggregate({
    where: {
      sellerId,
      currency: "XOF",
      order: { status: "PAID", paidAt: { lte: threshold } },
    },
    _sum: { sellerAmount: true },
  });

  const payoutRows = await client.payout.groupBy({
    by: ["status"],
    where: { sellerId, currency: "XOF" },
    _sum: { amount: true },
  });

  const sumFor = (...statuses: PayoutStatus[]) =>
    payoutRows
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);

  const earned = earnedRow._sum.sellerAmount ?? 0;
  const released = releasedRow._sum.sellerAmount ?? 0;
  const paid = sumFor("PAID");
  const open = sumFor("PENDING", "PROCESSING");

  return {
    earned,
    released,
    onHold: Math.max(0, earned - released),
    paid,
    open,
    available: Math.max(0, released - paid - open),
  };
  }
