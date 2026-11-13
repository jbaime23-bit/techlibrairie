// src/app/admin/impressions/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { getPrintJob, LuluApiError } from "@/lib/lulu";
import { dispatchPrintOrder, markPrintOrderPaid } from "@/lib/print-orders";
import {
  notifyBuyerPrintPaymentRejected,
  notifyBuyerPrintShipped,
} from "@/lib/print-order-notifications";

const BACK = "/admin/impressions";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readOrderId(formData: FormData): string | null {
  const value = readText(formData, "orderId", 40);
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function refresh(orderNumber?: string): void {
  revalidatePath(BACK);
  if (orderNumber) revalidatePath(`/acheteur/impression/${orderNumber}`);
}

/** Valide le paiement : la commande passe « Payée », puis son envoi est lancé (Burkina Faso : voie locale). */
export async function validatePrintPaymentAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readOrderId(formData);
  if (!orderId) {
    redirect(BACK);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { number: true, totalXof: true, paymentReference: true },
  });
  if (!order) {
    redirect(BACK);
  }

  const outcome = await markPrintOrderPaid(orderId, admin.email);

  if (!outcome.paid) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "impression.paiement_valide",
    targetType: "commande_imprimee",
    targetId: orderId,
    details: {
      numero: order.number,
      total_fcfa: order.totalXof,
      reference: order.paymentReference,
      envoi: outcome.message.slice(0, 200),
    },
  });

  refresh(order.number);
  redirect(`${BACK}?message=${outcome.ok ? "validee" : "validee-attention"}`);
}

/** Rejette un paiement déclaré : l'acheteur peut le déclarer à nouveau. */
export async function rejectPrintPaymentAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readOrderId(formData);
  if (!orderId) {
    redirect(BACK);
  }

  const reason = readText(formData, "reason", 200);
  if (reason.length < 3) {
    redirect(`${BACK}?erreur=motif`);
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { number: true, totalXof: true, paymentReference: true },
  });
  if (!order) {
    redirect(BACK);
  }

  const claimed = await prisma.printOrder.updateMany({
    where: { id: orderId, status: "PAYMENT_SUBMITTED" },
    data: { status: "AWAITING_PAYMENT", paymentRejectionReason: reason },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "impression.paiement_rejete",
    targetType: "commande_imprimee",
    targetId: orderId,
    details: { numero: order.number, reference: order.paymentReference, motif: reason },
  });

  await notifyBuyerPrintPaymentRejected(orderId, reason);

  refresh(order.number);
  redirect(`${BACK}?message=rejetee`);
}

/** Relance l'envoi d'une commande payée (envoi en erreur, ou envoi automatique désactivé jusque-là). */
export async function retryPrintDispatchAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readOrderId(formData);
  if (!orderId) {
    redirect(BACK);
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { number: true, status: true },
  });
  if (!order) {
    redirect(BACK);
  }

  // Après une erreur, une commande d'impression a pu être créée chez Lulu malgré tout : confirmation exigée.
  if (order.status === "ERROR" && formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation-envoi`);
  }

  const outcome = await dispatchPrintOrder(orderId);

  await recordAdminAction(admin, {
    action: "impression.envoi_relance",
    targetType: "commande_imprimee",
    targetId: orderId,
    details: { numero: order.number, resultat: outcome.message.slice(0, 200) },
  });

  refresh(order.number);
  redirect(`${BACK}?message=${outcome.ok ? "envoyee" : "envoi-echec"}`);
}

/** Actualise le statut d'une commande d'impression chez Lulu (suivi du colis compris). */
export async function syncLuluStatusAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readOrderId(formData);
  if (!orderId) {
    redirect(BACK);
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { number: true, status: true, luluPrintJobId: true },
  });
  if (!order || order.luluPrintJobId === null) {
    redirect(`${BACK}?erreur=etat`);
  }

  let job;
  try {
    job = await getPrintJob(order.luluPrintJobId);
  } catch (error) {
    const message = error instanceof LuluApiError ? error.message : "Erreur inconnue.";
    await prisma.printOrder.update({
      where: { id: orderId },
      data: { lastDispatchError: message.slice(0, 1500) },
    });
    refresh(order.number);
    redirect(`${BACK}?erreur=lulu`);
  }

  const status = job.status.toUpperCase();
  const trackingUrls = job.trackingUrls.length > 0 ? job.trackingUrls.join("\n") : null;
  let becameShipped = false;

  if (status === "SHIPPED" && order.status === "SENT_TO_LULU") {
    await prisma.printOrder.update({
      where: { id: orderId },
      data: { luluStatus: job.status, trackingUrls, status: "SHIPPED", shippedAt: new Date() },
    });
    becameShipped = true;
  } else if ((status === "CANCELED" || status === "REJECTED") && order.status === "SENT_TO_LULU") {
    await prisma.printOrder.update({
      where: { id: orderId },
      data: {
        luluStatus: job.status,
        status: "ERROR",
        lastDispatchError: `Lulu a indiqué le statut ${job.status}. ${job.statusMessage ?? ""}`.trim().slice(0, 1500),
      },
    });
  } else {
    await prisma.printOrder.update({
      where: { id: orderId },
      data: { luluStatus: job.status, ...(trackingUrls ? { trackingUrls } : {}) },
    });
  }

  if (becameShipped) {
    await notifyBuyerPrintShipped(orderId);
  }

  await recordAdminAction(admin, {
    action: "impression.statut_actualise",
    targetType: "commande_imprimee",
    targetId: orderId,
    details: { numero: order.number, statut_lulu: job.status },
  });

  refresh(order.number);
  redirect(`${BACK}?message=actualisee`);
}

/** Commande livrée au Burkina Faso : marquée expédiée, avec une note (transporteur, numéro de suivi...). */
export async function markLocalShippedAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readOrderId(formData);
  if (!orderId) {
    redirect(BACK);
  }

  const note = readText(formData, "note", 300);

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { number: true },
  });
  if (!order) {
    redirect(BACK);
  }

  const claimed = await prisma.printOrder.updateMany({
    where: { id: orderId, status: "LOCAL_PENDING" },
    data: { status: "SHIPPED", shippedAt: new Date(), fulfilmentNote: note === "" ? null : note },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "impression.expediee_localement",
    targetType: "commande_imprimee",
    targetId: orderId,
    details: { numero: order.number, note },
  });

  await notifyBuyerPrintShipped(orderId);

  refresh(order.number);
  redirect(`${BACK}?message=expediee`);
}

/** Marque une commande comme livrée. */
export async function markPrintDeliveredAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readOrderId(formData);
  if (!orderId) {
    redirect(BACK);
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { number: true },
  });
  if (!order) {
    redirect(BACK);
  }

  const claimed = await prisma.printOrder.updateMany({
    where: { id: orderId, status: { in: ["SHIPPED", "SENT_TO_LULU", "LOCAL_PENDING"] } },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "impression.livree",
    targetType: "commande_imprimee",
    targetId: orderId,
    details: { numero: order.number },
  });

  refresh(order.number);
  redirect(`${BACK}?message=livree`);
}

/** Annule une commande qui n'a pas été transmise à Lulu. Si elle était payée, elle est à rembourser. */
export async function cancelPrintOrderAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const orderId = readOrderId(formData);
  if (!orderId) {
    redirect(BACK);
  }

  const reason = readText(formData, "reason", 200);
  if (reason.length < 3) {
    redirect(`${BACK}?erreur=motif`);
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { number: true, status: true, totalXof: true, paidAt: true },
  });
  if (!order) {
    redirect(BACK);
  }

  const claimed = await prisma.printOrder.updateMany({
    where: {
      id: orderId,
      status: { in: ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "PAID", "ERROR", "LOCAL_PENDING"] },
    },
    data: { status: "CANCELED", canceledReason: reason },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  const refundDue = order.paidAt !== null;

  await recordAdminAction(admin, {
    action: "impression.commande_annulee",
    targetType: "commande_imprimee",
    targetId: orderId,
    details: {
      numero: order.number,
      motif: reason,
      a_rembourser: refundDue,
      montant_fcfa: refundDue ? order.totalXof : 0,
    },
  });

  refresh(order.number);
  redirect(`${BACK}?message=${refundDue ? "annulee-remboursement" : "annulee"}`);
}
