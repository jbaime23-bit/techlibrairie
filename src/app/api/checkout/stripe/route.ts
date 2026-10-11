// src/app/api/checkout/stripe/route.ts
// Démarre un paiement par carte bancaire (ouvrages en EUR ou USD).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  CheckoutError,
  cancelPendingOrder,
  createPendingOrder,
  getAppUrl,
} from "@/lib/orders";
import { createStripeCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Veuillez vous connecter pour payer." },
      { status: 401 }
    );
  }

  let orderId: string | null = null;

  try {
    const { order } = await createPendingOrder({
      userId: user.id,
      email: user.email,
      allowedCurrencies: ["EUR", "USD"],
    });
    orderId = order.id;

    const session = await createStripeCheckoutSession({
      orderId: order.id,
      orderNumber: order.number,
      buyerEmail: order.buyerEmail,
      currency: order.currency,
      items: order.items.map((item) => ({
        title: item.productTitle,
        unitAmount: item.unitAmount,
      })),
      appUrl: getAppUrl(),
    });

    if (!session.url) {
      throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
    }

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "STRIPE",
        method: "CARD",
        status: "PENDING",
        amount: order.totalAmount,
        currency: order.currency,
        providerReference: session.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Erreur Stripe Checkout :", error);
    if (orderId) {
      await cancelPendingOrder(orderId).catch(() => undefined);
    }

    return NextResponse.json(
      {
        error:
          "Le paiement par carte est momentanément indisponible. Veuillez réessayer dans un instant.",
      },
      { status: 502 }
    );
  }
}
