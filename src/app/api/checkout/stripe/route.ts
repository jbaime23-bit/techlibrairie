// src/app/api/checkout/stripe/route.ts
// Démarre un paiement par carte bancaire.
// Panier en FCFA : le montant est converti en euros ou en dollars (taux et marge enregistrés).
// Ancien panier en EUR ou USD : aucun changement de devise.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import {
  CheckoutError,
  cancelPendingOrder,
  createPendingOrder,
  getAppUrl,
} from "@/lib/orders";
import { createStripeCheckoutSession } from "@/lib/stripe";
import {
  MIN_CARD_CHARGE_MINOR,
  convertAmounts,
  getCardRate,
  type CardRate,
  type ForeignCurrency,
} from "@/lib/fx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currency: z.enum(["EUR", "USD"]).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Veuillez vous connecter pour payer." },
      { status: 401 }
    );
  }

  // Devise de débit choisie (euro par défaut) ; un corps vide est accepté.
  let chargeCurrency: ForeignCurrency = "EUR";
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (parsed.success && parsed.data.currency) {
      chargeCurrency = parsed.data.currency;
    }
  } catch {
    // Aucun corps de requête : on garde l'euro.
  }

  let orderId: string | null = null;

  try {
    const cart = await loadCart();
    if (cart.items.length === 0 || !cart.currency) {
      throw new CheckoutError("Votre panier est vide.");
    }

    // Le taux est vérifié AVANT de créer la commande.
    let rate: CardRate | null = null;
    if (cart.currency === "XOF") {
      rate = await getCardRate(chargeCurrency);
      if (!rate) {
        throw new CheckoutError(
          `Le paiement par carte en ${chargeCurrency === "EUR" ? "euros" : "dollars"} est momentanément indisponible. Utilisez le Mobile Money ou une autre devise.`,
          503
        );
      }
    }

    const { order } = await createPendingOrder({
      userId: user.id,
      email: user.email,
      allowedCurrencies: ["XOF", "EUR", "USD"],
    });
    orderId = order.id;

    let paymentCurrency: Currency = order.currency;
    let paymentAmount = order.totalAmount;
    let baseAmountXof: number | null = null;
    let exchangeRate: string | null = null;
    let items = order.items.map((item) => ({
      title: item.productTitle,
      unitAmount: item.unitAmount,
    }));

    if (order.currency === "XOF") {
      if (!rate) {
        throw new CheckoutError("Taux de change indisponible. Veuillez réessayer.", 503);
      }

      const converted = convertAmounts(
        order.items.map((item) => item.unitAmount),
        rate
      );

      if (converted.total < MIN_CARD_CHARGE_MINOR) {
        throw new CheckoutError(
          "Le montant est trop faible pour un paiement par carte. Utilisez le Mobile Money."
        );
      }

      paymentCurrency = rate.currency;
      paymentAmount = converted.total;
      baseAmountXof = order.totalAmount;
      exchangeRate = (rate.effectiveRateMicro / 1_000_000).toFixed(6);
      items = order.items.map((item, index) => ({
        title: item.productTitle,
        unitAmount: converted.amounts[index],
      }));
    }

    const session = await createStripeCheckoutSession({
      orderId: order.id,
      orderNumber: order.number,
      buyerEmail: order.buyerEmail,
      currency: paymentCurrency,
      items,
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
        amount: paymentAmount,
        currency: paymentCurrency,
        baseAmountXof,
        exchangeRate,
        providerReference: session.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (orderId) {
      await cancelPendingOrder(orderId).catch(() => undefined);
    }

    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Erreur Stripe Checkout :", error);

    return NextResponse.json(
      {
        error:
          "Le paiement par carte est momentanément indisponible. Veuillez réessayer dans un instant.",
      },
      { status: 502 }
    );
  }
}
