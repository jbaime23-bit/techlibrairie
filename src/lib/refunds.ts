// src/lib/refunds.ts
// Remboursement des commandes : appel Stripe (carte) et mise à jour de la base.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { notifyOrderRefunded } from "@/lib/notifications";

export class RefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundError";
  }
}

function asJsonObject(value: unknown): Prisma.JsonObject {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
}

/**
 * Passe une commande payée en "remboursée" : invalide les liens de téléchargement,
 * retire la vente du compteur du produit et trace le remboursement.
 * Idempotent : renvoie true uniquement la première fois.
 */
export async function markOrderRefunded(params: {
  orderId: string;
  paymentId: string | null;
  method: string;
  reason: string;
  reference?: string | null;
  adminId?: string | null;
}): Promise<boolean> {
  const now = new Date();

  const refunded = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: params.orderId, status: "PAID" },
      data: { status: "REFUNDED" },
    });

    if (claimed.count === 0) return false;

    if (params.paymentId) {
      const existing = await tx.payment.findFirst({
        where: { id: params.paymentId, orderId: params.orderId },
        select: { providerPayload: true },
      });

      if (existing) {
        const payload = {
          ...asJsonObject(existing.providerPayload),
          refund: {
            at: now.toISOString(),
            method: params.method,
            reason: params.reason,
            reference: params.reference ?? null,
            adminId: params.adminId ?? null,
          },
        } as Prisma.InputJsonObject;

        await tx.payment.update({
          where: { id: params.paymentId },
          data: { status: "REFUNDED", providerPayload: payload },
        });
      }
    }

    // Les liens de téléchargement expirent immédiatement.
    await tx.downloadToken.updateMany({
      where: { orderItem: { orderId: params.orderId }, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });

    const items = await tx.orderItem.findMany({
      where: { orderId: params.orderId },
      select: { productId: true },
    });

    for (const item of items) {
      await tx.product.updateMany({
        where: { id: item.productId, salesCount: { gt: 0 } },
        data: { salesCount: { decrement: 1 } },
      });
    }

    return true;
  });

  if (refunded) {
    await notifyOrderRefunded(params.orderId, params.method);
  }

  return refunded;
}

/**
 * Rembourse intégralement un paiement par carte via Stripe.
 * La clé d'idempotence empêche tout double remboursement.
 */
export async function refundStripePayment(payment: {
  id: string;
  providerReference: string;
}): Promise<{ refundId: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.retrieve(payment.providerReference);

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new RefundError("Paiement Stripe introuvable ou non encaissé.");
  }

  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntentId, reason: "requested_by_customer" },
    { idempotencyKey: `refund-${payment.id}` }
  );

  return { refundId: refund.id };
            }
