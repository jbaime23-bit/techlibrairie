// src/app/api/webhooks/cinetpay/route.ts
// Notification de paiement CinetPay (notify_url) pour les commandes et le support.
// CinetPay appelle cette URL en GET (test de disponibilité) et en POST (notification).
// Le statut n'est jamais lu dans la notification : il est revérifié via l'API CinetPay.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCinetPayPayment } from "@/lib/orders";
import { syncSupportPayment } from "@/lib/support";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse("OK", { status: 200 });
}

export async function POST(request: Request) {
  let transactionId: string | null = null;
  let siteId: string | null = null;

  try {
    const form = await request.formData();
    const rawTransactionId = form.get("cpm_trans_id");
    const rawSiteId = form.get("cpm_site_id");
    transactionId = typeof rawTransactionId === "string" ? rawTransactionId : null;
    siteId = typeof rawSiteId === "string" ? rawSiteId : null;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!transactionId || !/^[A-Za-z0-9_-]{1,60}$/.test(transactionId)) {
    return NextResponse.json({ error: "Transaction manquante." }, { status: 400 });
  }

  if (siteId && process.env.CINETPAY_SITE_ID && siteId !== process.env.CINETPAY_SITE_ID) {
    return NextResponse.json({ error: "Site inconnu." }, { status: 400 });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { providerReference: transactionId },
    });

    if (payment) {
      if (payment.provider === "CINETPAY" && payment.status === "PENDING") {
        await syncCinetPayPayment(payment);
      }
      return new NextResponse("OK", { status: 200 });
    }

    const supportPayment = await prisma.supportPayment.findUnique({
      where: { providerReference: transactionId },
    });

    if (
      supportPayment &&
      supportPayment.provider === "CINETPAY" &&
      supportPayment.status === "PENDING"
    ) {
      await syncSupportPayment(supportPayment);
    }

    // Transaction inconnue ou déjà traitée : on répond 200 sans rien faire.
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Erreur de traitement de la notification CinetPay :", error);
    return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
  }
      }
