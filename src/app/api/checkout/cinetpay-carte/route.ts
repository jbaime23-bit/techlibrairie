// src/app/api/checkout/cinetpay-carte/route.ts
// Démarre un paiement par carte bancaire via le guichet CinetPay (commandes en FCFA).
// Désactivé tant que la variable CINETPAY_CARD_ENABLED n'est pas "true".

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
import { billingSchema } from "@/lib/billing-validation";
import { normalizeMobileNumber } from "@/lib/payouts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.CINETPAY_CARD_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Le paiement par carte bancaire n'est pas disponible pour le moment." },
      { status: 404 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Veuillez vous connecter pour payer." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = billingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Veuillez corriger les champs signalés.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const billing = parsed.data;

  const phoneDigits = normalizeMobileNumber(billing.phone);
  if (!phoneDigits) {
    return NextResponse.json(
      {
        error: "Veuillez corriger les champs signalés.",
        fieldErrors: {
          phone: [
            "Numéro invalide : saisissez 8 chiffres (Burkina Faso) ou un numéro international avec l'indicatif du pays.",
          ],
        },
      },
      { status: 422 }
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
    const transactionId = `TC${randomBytes(9).toString("hex")}`;

    // Le paiement est enregistré AVANT d'ouvrir le guichet (recommandation CinetPay).
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "CINETPAY",
        method: "CARD",
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
      channels: "CREDIT_CARD",
      customer: {
        id: user.id,
        name: billing.name,
        surname: billing.surname,
        phoneNumber: `+${phoneDigits}`,
        email: user.email,
        address: billing.address,
        city: billing.city,
        country: billing.country,
        state: billing.state,
        zipCode: billing.zipCode,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPayload: { paymentToken: init.paymentToken } },
    });

    return NextResponse.json({ url: init.paymentUrl });
  } catch (error) {
    if (error instanceof CheckoutError) {
      if (orderId) {
        await cancelPendingOrder(orderId).catch(() => undefined);
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Erreur CinetPay (carte) :", error);

    if (paymentId) {
      await markPaymentFailed(paymentId, "FAILED").catch(() => undefined);
    } else if (orderId) {
      await cancelPendingOrder(orderId).catch(() => undefined);
    }

    return NextResponse.json(
      {
        error:
          "Le paiement par carte est momentanément indisponible. Veuillez réessayer dans un instant ou utiliser le Mobile Money.",
      },
      { status: 502 }
    );
  }
}
