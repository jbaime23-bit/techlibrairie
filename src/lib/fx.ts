// src/lib/fx.ts
// Taux de change et conversion des prix en FCFA vers l'euro ou le dollar
// pour le paiement par carte bancaire.
//
// - Le taux publié est le nombre de FCFA pour 1 unité de la devise.
// - La marge de conversion (PlatformSetting.fxMarginBps) est incluse : le client
//   paie un peu plus de devise étrangère, jamais un supplément séparé.
// - Les calculs se font en entiers (taux x 1 000 000) pour éviter tout écart d'arrondi.

import { prisma } from "@/lib/prisma";

export type ForeignCurrency = "EUR" | "USD";

export const FOREIGN_CURRENCIES: ForeignCurrency[] = ["EUR", "USD"];

// Parité fixe du franc CFA avec l'euro : 1 EUR = 655,957 FCFA.
export const EUR_PEG_XOF_PER_EUR = 655.957;

// Bornes de bon sens pour la saisie d'un taux (FCFA pour 1 unité)
export const RATE_BOUNDS: Record<ForeignCurrency, { min: number; max: number }> = {
  EUR: { min: 600, max: 720 },
  USD: { min: 300, max: 900 },
};

// Au-delà de cet âge, un taux saisi (hors euro) n'est plus utilisé pour les paiements.
export const MAX_RATE_AGE_DAYS = 60;

// Montant minimal d'un paiement par carte (en centimes), exigence de Stripe.
export const MIN_CARD_CHARGE_MINOR = 50;

const DEFAULT_MARGIN_BPS = 200;
const MICRO = 1_000_000;

export interface CardRate {
  currency: ForeignCurrency;
  // Taux publié, en millionièmes de FCFA par unité de devise
  baseRateMicro: number;
  // Taux réellement appliqué (marge incluse), en millionièmes
  effectiveRateMicro: number;
  marginBps: number;
  source: "parité fixe" | "saisi par l'administrateur";
  updatedAt: Date | null;
}

export function isForeignCurrency(value: string): value is ForeignCurrency {
  return value === "EUR" || value === "USD";
}

/** Affiche un taux en millionièmes, ex. 655957000 devient "655,957". */
export function formatRateMicro(rateMicro: number): string {
  return (rateMicro / MICRO).toLocaleString("fr-FR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 6,
  });
}

/** Taux de la devise pour les paiements par carte, ou null s'il n'est pas disponible. */
export async function getCardRate(
  currency: ForeignCurrency
): Promise<CardRate | null> {
  const [settings, row] = await Promise.all([
    prisma.platformSetting.findUnique({
      where: { id: "global" },
      select: { fxMarginBps: true },
    }),
    prisma.exchangeRate.findFirst({
      where: { currency, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const marginBps = settings?.fxMarginBps ?? DEFAULT_MARGIN_BPS;

  let baseRateMicro: number;
  let source: CardRate["source"];
  let updatedAt: Date | null;

  if (row) {
    const ageMs = Date.now() - row.createdAt.getTime();
    // La parité de l'euro étant fixe, seul le dollar est soumis à l'âge maximal.
    if (currency !== "EUR" && ageMs > MAX_RATE_AGE_DAYS * 24 * 60 * 60 * 1000) {
      return null;
    }
    baseRateMicro = Math.round(row.xofPerUnit.toNumber() * MICRO);
    source = "saisi par l'administrateur";
    updatedAt = row.createdAt;
  } else if (currency === "EUR") {
    baseRateMicro = Math.round(EUR_PEG_XOF_PER_EUR * MICRO);
    source = "parité fixe";
    updatedAt = null;
  } else {
    return null;
  }

  if (!Number.isFinite(baseRateMicro) || baseRateMicro <= 0) {
    return null;
  }

  const effectiveRateMicro = Math.round(
    (baseRateMicro * 10000) / (10000 + marginBps)
  );

  return {
    currency,
    baseRateMicro,
    effectiveRateMicro,
    marginBps,
    source,
    updatedAt,
  };
}

/**
 * Convertit un montant en FCFA en unité mineure (centimes) de la devise cible,
 * arrondi au centime supérieur.
 */
export function convertXofToMinor(amountXof: number, rate: CardRate): number {
  if (!Number.isInteger(amountXof) || amountXof < 0) {
    throw new Error(`Montant invalide : ${amountXof}.`);
  }

  const numerator = BigInt(amountXof) * BigInt(100) * BigInt(MICRO);
  const denominator = BigInt(rate.effectiveRateMicro);
  const quotient = (numerator + denominator - BigInt(1)) / denominator;

  return Number(quotient);
}

/**
 * Convertit chaque ligne d'une commande ; le total à débiter est la somme
 * des lignes converties (il correspond exactement à ce que Stripe affichera).
 */
export function convertAmounts(
  amountsXof: number[],
  rate: CardRate
): { amounts: number[]; total: number } {
  const amounts = amountsXof.map((amount) => convertXofToMinor(amount, rate));
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return { amounts, total };
}
