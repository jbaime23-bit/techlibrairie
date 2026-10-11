// src/lib/commission.ts
// Calcul de la commission de la boutique sur chaque vente.
// Les taux sont exprimés en points de base : 1000 = 10 %, 250 = 2,5 %.
// Aucune taxe n'est appliquée sur les produits numériques.

import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BPS_DENOMINATOR = 10000;
export const FALLBACK_COMMISSION_RATE_BPS = 1000;

/** Vérifie qu'un taux en points de base est un entier entre 0 et 10000. */
export function assertValidRateBps(rateBps: number): void {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > BPS_DENOMINATOR) {
    throw new Error(
      `Taux de commission invalide : ${rateBps}. Il doit être un entier entre 0 et ${BPS_DENOMINATOR}.`
    );
  }
}

/** 1000 => 10 */
export function bpsToPercent(rateBps: number): number {
  return rateBps / 100;
}

/** 10 => 1000 */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/**
 * Détermine le taux appliqué : celui du vendeur s'il en a un,
 * sinon le taux par défaut de la plateforme.
 */
export function resolveCommissionRateBps(
  sellerRateBps: number | null | undefined,
  defaultRateBps: number
): number {
  const rate =
    sellerRateBps === null || sellerRateBps === undefined
      ? defaultRateBps
      : sellerRateBps;
  assertValidRateBps(rate);
  return rate;
}

export interface CommissionSplit {
  commissionAmount: number;
  sellerAmount: number;
}

/**
 * Répartit un montant entre la boutique et le vendeur.
 * Arrondi à l'unité la plus proche ; commission + part vendeur = montant exact.
 */
export function computeSplit(unitAmount: number, rateBps: number): CommissionSplit {
  if (!Number.isInteger(unitAmount) || unitAmount < 0) {
    throw new Error(`Montant invalide : ${unitAmount}.`);
  }
  assertValidRateBps(rateBps);

  const commissionAmount = Math.floor(
    (unitAmount * rateBps + BPS_DENOMINATOR / 2) / BPS_DENOMINATOR
  );
  const sellerAmount = unitAmount - commissionAmount;

  return { commissionAmount, sellerAmount };
}

/** Lit le taux de commission par défaut dans les paramètres globaux. */
export async function getDefaultCommissionRateBps(): Promise<number> {
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "global" },
    select: { defaultCommissionRateBps: true },
  });
  return settings?.defaultCommissionRateBps ?? FALLBACK_COMMISSION_RATE_BPS;
}

export interface CartLineInput {
  productId: string;
  productTitle: string;
  unitAmount: number;
  currency: Currency;
  sellerId: string;
  sellerRateBps: number | null;
}

export interface OrderLineData {
  productId: string;
  sellerId: string;
  productTitle: string;
  unitAmount: number;
  currency: Currency;
  commissionRateBps: number;
  commissionAmount: number;
  sellerAmount: number;
}

export interface OrderTotals {
  lines: OrderLineData[];
  currency: Currency;
  totalAmount: number;
  totalCommission: number;
  totalSellerAmount: number;
}

/**
 * Construit les lignes d'une commande avec la commission figée sur chacune.
 * Règles : panier non vide, une seule devise, un exemplaire par produit
 * (produits numériques), aucune taxe ajoutée.
 */
export function buildOrderLines(
  inputs: CartLineInput[],
  defaultRateBps: number
): OrderTotals {
  if (inputs.length === 0) {
    throw new Error("Le panier est vide.");
  }

  const currency = inputs[0].currency;
  const seen = new Set<string>();
  const lines: OrderLineData[] = [];

  for (const input of inputs) {
    if (input.currency !== currency) {
      throw new Error(
        "Le panier contient des produits dans des devises différentes. Passez une commande par devise."
      );
    }
    if (seen.has(input.productId)) {
      throw new Error("Un même produit ne peut apparaître qu'une fois dans le panier.");
    }
    seen.add(input.productId);

    const rateBps = resolveCommissionRateBps(input.sellerRateBps, defaultRateBps);
    const { commissionAmount, sellerAmount } = computeSplit(input.unitAmount, rateBps);

    lines.push({
      productId: input.productId,
      sellerId: input.sellerId,
      productTitle: input.productTitle,
      unitAmount: input.unitAmount,
      currency: input.currency,
      commissionRateBps: rateBps,
      commissionAmount,
      sellerAmount,
    });
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.unitAmount, 0);
  const totalCommission = lines.reduce((sum, line) => sum + line.commissionAmount, 0);
  const totalSellerAmount = lines.reduce((sum, line) => sum + line.sellerAmount, 0);

  return { lines, currency, totalAmount, totalCommission, totalSellerAmount };
}
