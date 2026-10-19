// src/lib/promo.ts
// Codes promotionnels : validation, calcul de la remise et répartition entre la boutique et les vendeurs.
//
// Règles :
// - les codes s'appliquent aux paniers en FCFA uniquement ;
// - la remise est un multiple de 5 (exigence du paiement Mobile Money) ;
// - le montant à payer ne descend jamais sous 100 FCFA ;
// - règle "PROPORTIONAL" : la remise est répartie sur les lignes au prorata des prix, et la
//   commission est recalculée sur le prix remisé (boutique et vendeur la supportent ensemble) ;
// - règle "SHOP" : le vendeur garde son gain normal, la boutique supporte seule la remise
//   (elle est donc plafonnée au total des commissions normales du panier) ;
// - un code est compté comme utilisé par les commandes payées et, pendant 2 heures, par les
//   commandes en cours d'autres acheteurs.

import { cookies } from "next/headers";
import type { Currency, PromoBearer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BPS_DENOMINATOR,
  computeSplit,
  getDefaultCommissionRateBps,
  resolveCommissionRateBps,
} from "@/lib/commission";
import type { Cart } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";

export const PROMO_COOKIE = "tl_promo";
export const MIN_PAYABLE_XOF = 100;

const PENDING_HOLD_MS = 2 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

// ---------------------------------------------------------------------------
// Code mémorisé dans le navigateur
// ---------------------------------------------------------------------------

/** Met un code au format canonique (majuscules, sans espaces), ou renvoie null s'il est invalide. */
export function normalizePromoCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

/** Code promotionnel mémorisé par l'acheteur (cookie), ou null. */
export async function getPromoCode(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PROMO_COOKIE)?.value;
  return raw ? normalizePromoCode(raw) : null;
}

/** Mémorise le code. À appeler uniquement depuis une Server Action ou une route API. */
export async function setPromoCode(code: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PROMO_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });
}

/** Oublie le code. À appeler uniquement depuis une Server Action ou une route API. */
export async function clearPromoCode(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PROMO_COOKIE);
}

// ---------------------------------------------------------------------------
// Motifs de refus et messages
// ---------------------------------------------------------------------------

export type PromoFailure =
  | "format"
  | "limite"
  | "invalide"
  | "pas-commence"
  | "expire"
  | "devise"
  | "minimum"
  | "epuise"
  | "deja-utilise"
  | "sans-effet";

export const PROMO_FAILURES: readonly PromoFailure[] = [
  "format",
  "limite",
  "invalide",
  "pas-commence",
  "expire",
  "devise",
  "minimum",
  "epuise",
  "deja-utilise",
  "sans-effet",
];

export function isPromoFailure(value: string | undefined): value is PromoFailure {
  return PROMO_FAILURES.some((failure) => failure === value);
}

export function promoFailureMessage(reason: PromoFailure, minAmount?: number): string {
  switch (reason) {
    case "format":
      return "Code invalide : 3 à 30 caractères (lettres, chiffres et tirets).";
    case "limite":
      return "Trop d'essais. Patientez 15 minutes avant de saisir un autre code.";
    case "invalide":
      return "Ce code promotionnel est invalide.";
    case "pas-commence":
      return "Ce code n'est pas encore valable.";
    case "expire":
      return "Ce code a expiré.";
    case "devise":
      return "Ce code s'applique uniquement aux ouvrages en FCFA.";
    case "minimum":
      return minAmount
        ? `Ce code est valable à partir de ${formatPrice(minAmount, "XOF")} d'achats.`
        : "Le montant de votre panier est insuffisant pour ce code.";
    case "epuise":
      return "Ce code a atteint son nombre maximal d'utilisations.";
    case "deja-utilise":
      return "Vous avez déjà utilisé ce code.";
    case "sans-effet":
      return "Ce code ne donne aucune remise sur ce panier.";
  }
}

// ---------------------------------------------------------------------------
// Calcul de la remise
// ---------------------------------------------------------------------------

export interface PromoLineInput {
  // Prix catalogue de la ligne (FCFA)
  listAmount: number;
  // Taux de commission normal appliqué à cette ligne (points de base)
  rateBps: number;
}

export interface PromoLineResult {
  listAmount: number;
  discountAmount: number;
  // Prix réellement payé pour la ligne
  unitAmount: number;
  commissionRateBps: number;
  commissionAmount: number;
  sellerAmount: number;
}

export interface PromoApplication {
  promoId: string;
  code: string;
  bearer: PromoBearer;
  // Remise demandée par le code, avant plafonnement
  requestedDiscount: number;
  discountTotal: number;
  capped: boolean;
  finalTotal: number;
  lines: PromoLineResult[];
}

export type PromoEvaluation =
  | { ok: true; application: PromoApplication }
  | { ok: false; reason: PromoFailure; minAmount?: number };

function floorToFive(value: number): number {
  return Math.floor(value / 5) * 5;
}

/**
 * Répartit un montant entier entre plusieurs lignes au prorata de poids (méthode du plus fort reste).
 * La somme des parts est exactement égale au montant ; une part ne dépasse jamais son poids
 * tant que le montant total ne dépasse pas la somme des poids.
 */
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);

  const shares = weights.map((weight, index) => {
    const product = total * weight;
    return { index, base: Math.floor(product / sum), fraction: product % sum };
  });

  const result = shares.map((share) => share.base);
  let remainder = total - result.reduce((acc, value) => acc + value, 0);

  const order = [...shares].sort(
    (a, b) => b.fraction - a.fraction || a.index - b.index
  );

  for (const entry of order) {
    if (remainder <= 0) break;
    if (weights[entry.index] > 0) {
      result[entry.index] += 1;
      remainder -= 1;
    }
  }

  return result;
}

/** Nombre de commandes qui comptent comme utilisations du code. */
async function countUses(
  promoId: string,
  userId: string | null
): Promise<{ total: number; byUser: number }> {
  const since = new Date(Date.now() - PENDING_HOLD_MS);

  const [total, byUser] = await Promise.all([
    prisma.order.count({
      where: {
        promoCodeId: promoId,
        OR: [
          { status: "PAID" },
          {
            status: "PENDING",
            createdAt: { gt: since },
            // Les tentatives abandonnées du même acheteur ne le bloquent pas.
            ...(userId ? { buyerId: { not: userId } } : {}),
          },
        ],
      },
    }),
    userId
      ? prisma.order.count({
          where: { promoCodeId: promoId, buyerId: userId, status: "PAID" },
        })
      : Promise.resolve(0),
  ]);

  return { total, byUser };
}

/**
 * Vérifie un code pour un panier et calcule la remise ligne par ligne.
 * Ne modifie rien en base.
 */
export async function evaluatePromo(params: {
  code: string;
  userId: string | null;
  currency: Currency;
  lines: PromoLineInput[];
}): Promise<PromoEvaluation> {
  const promo = await prisma.promoCode.findUnique({ where: { code: params.code } });

  if (!promo || !promo.isActive) return { ok: false, reason: "invalide" };

  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return { ok: false, reason: "pas-commence" };
  if (promo.endsAt && promo.endsAt <= now) return { ok: false, reason: "expire" };

  if (params.currency !== "XOF") return { ok: false, reason: "devise" };

  const totalList = params.lines.reduce((sum, line) => sum + line.listAmount, 0);

  if (totalList < promo.minOrderAmountXof) {
    return { ok: false, reason: "minimum", minAmount: promo.minOrderAmountXof };
  }

  const uses = await countUses(promo.id, params.userId);

  if (promo.maxRedemptions !== null && uses.total >= promo.maxRedemptions) {
    return { ok: false, reason: "epuise" };
  }
  if (params.userId && uses.byUser >= promo.maxPerUser) {
    return { ok: false, reason: "deja-utilise" };
  }

  // Remise demandée par le code (multiple de 5).
  const requested =
    promo.type === "PERCENT"
      ? Math.floor((totalList * promo.value) / 500) * 5
      : promo.value;

  // Commission normale de chaque ligne : plafond de la remise supportée par la boutique seule.
  const capacities = params.lines.map(
    (line) => computeSplit(line.listAmount, line.rateBps).commissionAmount
  );

  // Le montant à payer ne peut pas descendre sous le minimum.
  let allowed = floorToFive(totalList - MIN_PAYABLE_XOF);
  if (promo.bearer === "SHOP") {
    allowed = Math.min(
      allowed,
      floorToFive(capacities.reduce((sum, value) => sum + value, 0))
    );
  }

  const discountTotal = Math.min(requested, allowed);
  if (discountTotal <= 0) return { ok: false, reason: "sans-effet" };

  const weights =
    promo.bearer === "SHOP" ? capacities : params.lines.map((line) => line.listAmount);
  const discounts = distribute(discountTotal, weights);

  const lines: PromoLineResult[] = params.lines.map((line, index) => {
    const discountAmount = discounts[index];
    const unitAmount = line.listAmount - discountAmount;

    if (promo.bearer === "SHOP") {
      // Le vendeur garde son gain normal ; la commission absorbe la remise.
      const sellerAmount = line.listAmount - capacities[index];
      const commissionAmount = unitAmount - sellerAmount;
      const effectiveRate =
        unitAmount > 0
          ? Math.min(
              Math.max(Math.round((commissionAmount * BPS_DENOMINATOR) / unitAmount), 0),
              BPS_DENOMINATOR
            )
          : 0;

      return {
        listAmount: line.listAmount,
        discountAmount,
        unitAmount,
        commissionRateBps: effectiveRate,
        commissionAmount,
        sellerAmount,
      };
    }

    const split = computeSplit(unitAmount, line.rateBps);
    return {
      listAmount: line.listAmount,
      discountAmount,
      unitAmount,
      commissionRateBps: line.rateBps,
      commissionAmount: split.commissionAmount,
      sellerAmount: split.sellerAmount,
    };
  });

  return {
    ok: true,
    application: {
      promoId: promo.id,
      code: promo.code,
      bearer: promo.bearer,
      requestedDiscount: requested,
      discountTotal,
      capped: discountTotal < requested,
      finalTotal: totalList - discountTotal,
      lines,
    },
  };
}

// ---------------------------------------------------------------------------
// Aperçu pour le panier et la page de paiement
// ---------------------------------------------------------------------------

/** Lignes du panier avec leur taux de commission normal (relu en base). */
export async function loadLineInputs(cart: Cart): Promise<PromoLineInput[]> {
  const ids = cart.items.map((item) => item.id);

  const [products, defaultRateBps] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, seller: { select: { commissionRateBps: true } } },
    }),
    getDefaultCommissionRateBps(),
  ]);

  const rateById = new Map(
    products.map((product) => [
      product.id,
      resolveCommissionRateBps(product.seller.commissionRateBps, defaultRateBps),
    ])
  );

  return cart.items.map((item) => ({
    listAmount: item.priceAmount,
    rateBps: rateById.get(item.id) ?? defaultRateBps,
  }));
}

export interface PromoPreview {
  code: string;
  ok: boolean;
  message?: string;
  discountTotal: number;
  finalTotal: number;
  // Prix payé pour chaque ligne du panier, dans l'ordre du panier
  finalLineAmounts: number[];
  capped: boolean;
}

/** Remise du code mémorisé sur le panier courant, ou null s'il n'y a pas de code. */
export async function previewPromo(
  cart: Cart,
  userId: string | null
): Promise<PromoPreview | null> {
  const code = await getPromoCode();
  if (!code || cart.items.length === 0 || !cart.currency) return null;

  const lines = await loadLineInputs(cart);
  const result = await evaluatePromo({
    code,
    userId,
    currency: cart.currency,
    lines,
  });

  if (!result.ok) {
    return {
      code,
      ok: false,
      message: promoFailureMessage(result.reason, result.minAmount),
      discountTotal: 0,
      finalTotal: cart.totalAmount,
      finalLineAmounts: cart.items.map((item) => item.priceAmount),
      capped: false,
    };
  }

  return {
    code,
    ok: true,
    discountTotal: result.application.discountTotal,
    finalTotal: result.application.finalTotal,
    finalLineAmounts: result.application.lines.map((line) => line.unitAmount),
    capped: result.application.capped,
  };
}
