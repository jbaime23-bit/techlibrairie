// src/app/api/webhooks/stripe/route.ts
// Confirmation des paiements par carte (signature Stripe vérifiée).

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructStripeEvent } from "@/lib/stripe";
import { markPaymentFailed, syncPayment } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await prisma.payment.findUnique({
          where: { providerReference: session.id },
        });

        if (payment && payment.status === "PENDING") {
          await syncPayment(payment);
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await prisma.payment.findUnique({
          where: { providerReference: session.id },
        });

        if (payment) {
          await markPaymentFailed(payment.id, "FAILED");
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("Erreur de traitement du webhook Stripe :", error);
    // Une réponse 500 demande à Stripe de réessayer plus tard.
    return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
