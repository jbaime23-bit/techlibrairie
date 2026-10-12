// src/lib/orders.ts
// Création des commandes, confirmation des paiements et génération des liens
// de téléchargement. Toutes les opérations de confirmation sont idempotentes.

import type { Currency, Payment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadCart } from "@/lib/cart";
import { buildOrderLines, getDefaultCommissionRateBps } from "@/lib/commission";
import { generateDownloadToken, generateOrderNumber } from "@/lib/utils";
import { checkCinetPayPayment } from "@/lib/cinetpay";
import { getStripe } from "@/lib/stripe";
import { notifyOrderPaid } from "@/lib/notifications";

/** URL publique du site (obligatoire pour les retours et notifications de paiement). */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL est manquant.");
  }
  return url.replace(/\/+$/, "");
}

/** Erreur dont le message peut être montré à l'acheteur. */
export class CheckoutError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

export interface CreatePendingOrderOptions {
  userId: string;
  email: string;
  allowedCurrencies: Currency[];
  amountMultipleOf?: number;
}

/**
 * Crée une commande en attente à partir du panier, avec la commission
 * figée sur chaque ligne. Tous les prix sont relus en base.
 */
export async function createPendingOrder(options: CreatePendingOrderOptions) {
  const cart = await loadCart();

  if (cart.items.length === 0 || !cart.currency) {
    throw new CheckoutError("Votre panier est vide.");
  }

  if (!options.allowedCurrencies.includes(cart.currency)) {
    throw new CheckoutError(
      `Ce moyen de paiement n'est pas disponible pour les ouvrages en ${cart.currency}.`
    );
  }

  const ids = cart.items.map((item) => item.id);

  const products = await prisma.product.findMany({
    where: {
      id: { in: ids },
      status: "PUBLISHED",
      seller: { status: "ACTIVE" },
    },
    include: {
      seller: { select: { userId: true, commissionRateBps: true } },
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));
  const ordered: typeof products = [];
  for (const id of ids) {
    const product = byId.get(id);
    if (product) ordered.push(product);
  }

  if (ordered.length !== ids.length) {
    throw new CheckoutError(
      "Certains ouvrages de votre panier ne sont plus disponibles. Veuillez vérifier votre panier.",
      409
    );
  }

  if (ordered.some((product) => product.seller.userId === options.userId)) {
    throw new CheckoutError(
      "Vous ne pouvez pas acheter votre propre ouvrage. Retirez-le de votre panier.",
      409
    );
  }

  const alreadyBought = await prisma.orderItem.findMany({
    where: {
      productId: { in: ids },
      order: { buyerId: options.userId, status: "PAID" },
    },
    select: { productTitle: true },
  });

  if (alreadyBought.length > 0) {
    const titles = alreadyBought.map((item) => item.productTitle).join(", ");
    throw new CheckoutError(
      `Vous avez déjà acheté : ${titles}. Retirez-le de votre panier.`,
      409
    );
  }

  const defaultRateBps = await getDefaultCommissionRateBps();

  let totals;
  try {
    totals = buildOrderLines(
      ordered.map((product) => ({
        productId: product.id,
        productTitle: product.title,
        unitAmount: product.priceAmount,
        currency: product.currency,
        sellerId: product.sellerId,
        sellerRateBps: product.seller.commissionRateBps,
      })),
      defaultRateBps
    );
  } catch (error) {
    throw new CheckoutError(
      error instanceof Error ? error.message : "Panier invalide."
    );
  }

  if (
    options.amountMultipleOf &&
    totals.totalAmount % options.amountMultipleOf !== 0
  ) {
    throw new CheckoutError(
      `Le montant total doit être un multiple de ${options.amountMultipleOf} pour ce moyen de paiement. Contactez le support.`
    );
  }

  const order = await prisma.order.create({
    data: {
      number: generateOrderNumber(),
      buyerId: options.userId,
      buyerEmail: options.email,
      status: "PENDING",
      totalAmount: totals.totalAmount,
      currency: totals.currency,
      items: {
        create: totals.lines.map((line) => ({
          productId: line.productId,
          sellerId: line.sellerId,
          productTitle: line.productTitle,
          unitAmount: line.unitAmount,
          currency: line.currency,
          commissionRateBps: line.commissionRateBps,
          commissionAmount: line.commissionAmount,
          sellerAmount: line.sellerAmount,
        })),
      },
    },
    include: { items: true },
  });

  return { order, totals };
}

/** Annule une commande restée en attente (échec de création du paiement). */
export async function cancelPendingOrder(orderId: string): Promise<void> {
  await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "CANCELED" },
  });
}

/**
 * Marque une commande comme payée et génère les liens de téléchargement.
 * Idempotent : renvoie true uniquement la première fois.
 */
export async function markOrderPaid(params: {
  orderId: string;
  paymentId: string;
  providerPayload?: Prisma.InputJsonObject;
}): Promise<boolean> {
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "global" },
    select: { downloadLinkTtlHours: true, downloadMaxAttempts: true },
  });
  const ttlHours = settings?.downloadLinkTtlHours ?? 72;
  const maxDownloads = settings?.downloadMaxAttempts ?? 5;

  return prisma.$transaction(async (tx) => {
    // Verrou logique : une seule exécution peut faire passer la commande à PAID.
    const claimed = await tx.order.updateMany({
      where: {
        id: params.orderId,
        status: { in: ["PENDING", "FAILED", "CANCELED"] },
      },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (claimed.count === 0) return false;

    await tx.payment.updateMany({
      where: { id: params.paymentId, orderId: params.orderId },
      data: {
        status: "SUCCEEDED",
        ...(params.providerPayload ? { providerPayload: params.providerPayload } : {}),
      },
    });

    const items = await tx.orderItem.findMany({
      where: { orderId: params.orderId },
      select: { id: true, productId: true },
    });

    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    for (const item of items) {
      await tx.downloadToken.create({
        data: {
          orderItemId: item.id,
          token: generateDownloadToken(),
          expiresAt,
          maxDownloads,
        },
      });

      await tx.product.update({
        where: { id: item.productId },
        data: { salesCount: { increment: 1 } },
      });
    }

    return true;
  });
}

/** Marque un paiement comme échoué ou annulé (et la commande, si elle est encore en attente). */
export async function markPaymentFailed(
  paymentId: string,
  status: "FAILED" | "CANCELED"
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, orderId: true, status: true },
  });

  if (!payment || payment.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status } }),
    prisma.order.updateMany({
      where: { id: payment.orderId, status: "PENDING" },
      data: { status: status === "CANCELED" ? "CANCELED" : "FAILED" },
    }),
  ]);
}

export type SyncResult = "paid" | "failed" | "pending" | "mismatch";

/** Vérifie un paiement CinetPay auprès de CinetPay et met la base à jour. */
export async function syncCinetPayPayment(payment: Payment): Promise<SyncResult> {
  const result = await checkCinetPayPayment(payment.providerReference);

  if (result.status === "ACCEPTED") {
    if (result.amount !== payment.amount || result.currency !== payment.currency) {
      console.error(
        `CinetPay : montant ou devise inattendu pour ${payment.providerReference}`,
        { attendu: [payment.amount, payment.currency], recu: [result.amount, result.currency] }
      );
      return "mismatch";
    }

    const firstTime = await markOrderPaid({
      orderId: payment.orderId,
      paymentId: payment.id,
      providerPayload: {
        status: "ACCEPTED",
        paymentMethod: result.paymentMethod,
        operatorId: result.operatorId,
      },
    });

    if (firstTime) {
      await notifyOrderPaid(payment.orderId);
    }
    return "paid";
  }

  if (result.status === "REFUSED") {
    await markPaymentFailed(payment.id, "FAILED");
    return "failed";
  }

  return "pending";
}

/** Vérifie un paiement Stripe auprès de Stripe et met la base à jour. */
export async function syncStripePayment(payment: Payment): Promise<SyncResult> {
  const session = await getStripe().checkout.sessions.retrieve(
    payment.providerReference
  );

  if (session.payment_status === "paid") {
    if (
      session.amount_total !== payment.amount ||
      session.currency?.toUpperCase() !== payment.currency
    ) {
      console.error(
        `Stripe : montant ou devise inattendu pour ${payment.providerReference}`,
        {
          attendu: [payment.amount, payment.currency],
          recu: [session.amount_total, session.currency],
        }
      );
      return "mismatch";
    }

    const firstTime = await markOrderPaid({
      orderId: payment.orderId,
      paymentId: payment.id,
      providerPayload: { status: "paid", sessionId: session.id },
    });

    if (firstTime) {
      await notifyOrderPaid(payment.orderId);
    }
    return "paid";
  }

  if (session.status === "expired") {
    await markPaymentFailed(payment.id, "CANCELED");
    return "failed";
  }

  return "pending";
}

/** Vérifie un paiement selon son prestataire. */
export async function syncPayment(payment: Payment): Promise<SyncResult> {
  if (payment.provider === "CINETPAY") {
    return syncCinetPayPayment(payment);
  }
  return syncStripePayment(payment);
}

/** Vérifie tous les paiements en attente d'une commande (utilisé au retour du client). */
export async function syncOrderPayments(orderId: string): Promise<void> {
  const payments = await prisma.payment.findMany({
    where: { orderId, status: "PENDING" },
  });

  for (const payment of payments) {
    try {
      await syncPayment(payment);
    } catch (error) {
      console.error(`Vérification impossible du paiement ${payment.id} :`, error);
    }
  }
}
