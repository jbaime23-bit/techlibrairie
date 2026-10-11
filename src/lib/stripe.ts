// src/lib/stripe.ts
// Paiement par carte bancaire (Visa, Mastercard) avec Stripe Checkout.
// Aucune taxe automatique n'est activée : le montant payé est exactement le total de la commande.

import Stripe from "stripe";
import type { Currency } from "@prisma/client";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY est manquant.");
  }

  stripeClient = new Stripe(secretKey, {
    appInfo: { name: "TechLibrairie" },
  });
  return stripeClient;
}

export interface StripeCheckoutParams {
  orderId: string;
  orderNumber: string;
  buyerEmail: string;
  currency: Currency;
  items: { title: string; unitAmount: number }[];
  appUrl: string;
}

/**
 * Crée une session Stripe Checkout.
 * Les montants sont en unité minimale (centimes pour EUR et USD),
 * exactement comme stockés en base.
 */
export async function createStripeCheckoutSession(
  params: StripeCheckoutParams
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: params.buyerEmail,
    client_reference_id: params.orderId,
    line_items: params.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency: params.currency.toLowerCase(),
        unit_amount: item.unitAmount,
        product_data: { name: item.title.slice(0, 250) },
      },
    })),
    metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
    payment_intent_data: {
      metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
    },
    success_url: `${params.appUrl}/paiement/retour?commande=${params.orderId}`,
    cancel_url: `${params.appUrl}/panier`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
}

/** Vérifie la signature d'un webhook Stripe et renvoie l'événement. */
export function constructStripeEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET est manquant.");
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}
