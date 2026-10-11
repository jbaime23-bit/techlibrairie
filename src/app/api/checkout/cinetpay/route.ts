// src/app/api/checkout/cinetpay/route.ts
// Démarre un paiement Mobile Money (ouvrages en XOF).

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  CheckoutError,
  cancelPendingOrder,
  createPendingOrder,
  getAppUrl,
  markPaymentFailed,
} from "@/lib/orders";
import { initCinetPayPayment } from "@/lib/cinetpay";

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
  let paymentId: string | null = null;

  try {
    const { order } = await createPendingOrder({
      userId: user.id,
      email: user.email,
      allowedCurrencies: ["XOF"],
      amountMultipleOf: 5,
    });
    orderId = order.id;

    // Identifiant de transaction unique, alphanumérique.
    const transactionId = `TL${randomBytes(9).toString("hex")}`;

    // Le paiement est enregistré AVANT d'ouvrir le guichet (recommandation CinetPay).
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "CINETPAY",
        method: "MOBILE_MONEY",
        status: "PENDING",
        amount: order.totalAmount,
        currency: order.currency,
        providerReference: transactionId,
      },
    });
    paymentId = payment.id;

    const init = await initCinetPayPayment({
      transactionId,
      amount: order.totalAmount,
      description: `Commande ${order.number}`,
      orderId: order.id,
      appUrl: getAppUrl(),
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPayload: { paymentToken: init.paymentToken } },
    });

    return NextResponse.json({ url: init.paymentUrl });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Erreur CinetPay :", error);

    if (paymentId) {
      await markPaymentFailed(paymentId, "FAILED").catch(() => undefined);
    } else if (orderId) {
      await cancelPendingOrder(orderId).catch(() => undefined);
    }

    return NextResponse.json(
      {
        error:
          "Le paiement Mobile Money est momentanément indisponible. Veuillez réessayer dans un instant.",
      },
      { status: 502 }
    );
  }
      }
