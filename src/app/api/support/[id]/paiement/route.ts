// src/app/api/support/[id]/paiement/route.ts
// Démarre le paiement Mobile Money (CinetPay) d'une conversation de support.

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/orders";
import { initCinetPayPayment } from "@/lib/cinetpay";
import { markSupportPaymentFailed } from "@/lib/support";

export const dynamic = "force-dynamic";

const MAX_PAYMENT_ATTEMPTS_PER_HOUR = 5;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Veuillez vous connecter pour payer." },
      { status: 401 }
    );
  }

  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  const thread = await prisma.supportThread.findFirst({
    where: { id, userId: user.id },
    select: { id: true, number: true, status: true, feeAmountXof: true },
  });

  if (!thread) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  if (thread.status !== "AWAITING_PAYMENT") {
    return NextResponse.json(
      { error: "Cette conversation n'est pas en attente de paiement." },
      { status: 409 }
    );
  }

  const fee = thread.feeAmountXof;
  if (fee < 100 || fee % 5 !== 0) {
    return NextResponse.json(
      {
        error:
          "Le tarif de cette conversation n'est pas compatible avec le paiement Mobile Money. Contactez l'administration.",
      },
      { status: 400 }
    );
  }

  const recentAttempts = await prisma.supportPayment.count({
    where: {
      threadId: thread.id,
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  if (recentAttempts >= MAX_PAYMENT_ATTEMPTS_PER_HOUR) {
    return NextResponse.json(
      { error: "Trop de tentatives de paiement. Réessayez dans une heure." },
      { status: 429 }
    );
  }

  let paymentId: string | null = null;

  try {
    // Identifiant de transaction unique, alphanumérique.
    const transactionId = `TS${randomBytes(9).toString("hex")}`;

    const payment = await prisma.supportPayment.create({
      data: {
        threadId: thread.id,
        provider: "CINETPAY",
        method: "MOBILE_MONEY",
        status: "PENDING",
        amount: fee,
        currency: "XOF",
        baseAmountXof: fee,
        providerReference: transactionId,
      },
    });
    paymentId = payment.id;

    const init = await initCinetPayPayment({
      transactionId,
      amount: fee,
      description: `Support ${thread.number}`,
      orderId: thread.id,
      appUrl: getAppUrl(),
      returnPath: `/api/support/retour?fil=${thread.id}`,
    });

    await prisma.supportPayment.update({
      where: { id: payment.id },
      data: { providerPayload: { paymentToken: init.paymentToken } },
    });

    return NextResponse.json({ url: init.paymentUrl });
  } catch (error) {
    console.error("Erreur CinetPay (support) :", error);

    if (paymentId) {
      await markSupportPaymentFailed(paymentId, "FAILED").catch(() => undefined);
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
