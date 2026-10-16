// src/app/admin/commandes/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { markOrderRefunded, refundStripePayment } from "@/lib/refunds";
import { recordAdminAction } from "@/lib/audit";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Rembourse une commande payée.
 * - Carte (Stripe) : remboursement automatique et intégral.
 * - CinetPay (Mobile Money ou carte) : remboursement manuel déjà effectué par
 *   l'administrateur ; la référence de l'opération est exigée.
 */
export async function refundOrderAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readText(formData, "orderId", 40);
  if (!/^[a-z0-9]{1,40}$/i.test(orderId)) {
    redirect("/admin/commandes");
  }

  const back = `/admin/commandes/${orderId}`;

  if (formData.get("confirm") !== "oui") {
    redirect(`${back}?erreur=confirmation`);
  }

  const reason = readText(formData, "reason", 200);
  if (reason.length < 3) {
    redirect(`${back}?erreur=motif`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      payments: {
        where: { status: "SUCCEEDED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order || order.status !== "PAID") {
    redirect(`${back}?erreur=etat`);
  }

  const payment = order.payments[0];
  if (!payment) {
    redirect(`${back}?erreur=paiement`);
  }

  let method = "";
  let reference: string | null = null;

  if (payment.provider === "STRIPE") {
    try {
      const result = await refundStripePayment(payment);
      method = "stripe-api";
      reference = result.refundId;
    } catch (error) {
      const code = (error as { code?: string }).code;

      if (code === "charge_already_refunded") {
        // Déjà remboursé depuis le tableau de bord Stripe : on aligne la base.
        method = "stripe-deja-rembourse";
      } else {
        console.error("Erreur de remboursement Stripe :", error);
        redirect(`${back}?erreur=stripe`);
      }
    }
  } else {
    const manualReference = readText(formData, "reference", 100);
    if (!/^[A-Za-z0-9 _./-]{3,100}$/.test(manualReference)) {
      redirect(`${back}?erreur=reference`);
    }
    method = payment.method === "CARD" ? "manuel-cinetpay-carte" : "manuel-mobile-money";
    reference = manualReference;
  }

  const refunded = await markOrderRefunded({
    orderId: order.id,
    paymentId: payment.id,
    method,
    reason,
    reference,
    adminId: admin.id,
  });

  if (refunded) {
    await recordAdminAction(admin, {
      action: "commande.remboursee",
      targetType: "commande",
      targetId: order.id,
      details: { mode: method, motif: reason, reference },
    });
  }

  revalidatePath("/admin/commandes");
  revalidatePath(back);
  revalidatePath("/admin");
  revalidatePath("/admin/versements");
  revalidatePath("/vendeur/revenus");
  revalidatePath("/acheteur/commandes");

  redirect(`${back}?message=rembourse`);
      }
