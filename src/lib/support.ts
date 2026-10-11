// src/lib/support.ts
// Messagerie et support payant : libellés, tarif, confirmation des paiements.

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import type {
  Prisma,
  SupportCategory,
  SupportPayment,
  ThreadStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { checkCinetPayPayment } from "@/lib/cinetpay";
import type { SyncResult } from "@/lib/orders";

export const SUPPORT_CATEGORY_VALUES = [
  "GENERAL",
  "TECHNICAL",
  "PAYMENT",
  "SELLER_ACCOUNT",
  "OTHER",
] as const satisfies readonly SupportCategory[];

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  GENERAL: "Question générale",
  TECHNICAL: "Problème technique",
  PAYMENT: "Paiement ou commande",
  SELLER_ACCOUNT: "Compte vendeur",
  OTHER: "Autre demande",
};

// Libellés vus par l'utilisateur
export const USER_STATUS_LABELS: Record<ThreadStatus, string> = {
  AWAITING_PAYMENT: "En attente de paiement",
  OPEN: "En cours",
  ANSWERED: "Réponse de l'équipe",
  CLOSED: "Clôturée",
};

// Libellés vus par l'équipe
export const STAFF_STATUS_LABELS: Record<ThreadStatus, string> = {
  AWAITING_PAYMENT: "Non payée",
  OPEN: "À traiter",
  ANSWERED: "Répondue",
  CLOSED: "Clôturée",
};

export const STATUS_STYLES: Record<ThreadStatus, string> = {
  AWAITING_PAYMENT: "bg-yellow-100 text-yellow-800",
  OPEN: "bg-brand-100 text-brand-800",
  ANSWERED: "bg-green-100 text-green-800",
  CLOSED: "bg-slate-100 text-slate-700",
};

/** Date et heure en français. */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Numéro de conversation lisible, ex. SP-20261011-A1B2C3. */
export function generateThreadNumber(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear().toString();
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `SP-${yyyy}${mm}${dd}-${suffix}`;
}

/** Tarif actuel d'une conversation de support (en FCFA). */
export async function getSupportFeeXof(): Promise<number> {
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "global" },
    select: { supportFeeXof: true },
  });
  return settings?.supportFeeXof ?? 1000;
}

/** Pour les pages de support : exige un compte connecté non administrateur. */
export async function requireSupportUser(callbackUrl: string) {
  const user = await requireUser(callbackUrl);
  if (user.role === "ADMIN") {
    redirect("/admin/support");
  }
  return user;
}

/**
 * Marque le paiement comme réussi et ouvre la conversation.
 * Idempotent : renvoie true uniquement la première fois.
 */
export async function markSupportThreadPaid(params: {
  threadId: string;
  paymentId: string;
  providerPayload?: Prisma.InputJsonObject;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.supportPayment.updateMany({
      where: {
        id: params.paymentId,
        threadId: params.threadId,
        status: { not: "SUCCEEDED" },
      },
      data: {
        status: "SUCCEEDED",
        ...(params.providerPayload ? { providerPayload: params.providerPayload } : {}),
      },
    });

    if (payment.count === 0) return false;

    const now = new Date();

    // Une conversation abandonnée (clôturée sans paiement) est rouverte
    // si son paiement aboutit finalement.
    const claimed = await tx.supportThread.updateMany({
      where: {
        id: params.threadId,
        paidAt: null,
        status: { in: ["AWAITING_PAYMENT", "CLOSED"] },
      },
      data: { status: "OPEN", paidAt: now, closedAt: null, lastMessageAt: now },
    });

    return claimed.count > 0;
  });
}

/** Marque un paiement de support comme échoué ou annulé. */
export async function markSupportPaymentFailed(
  paymentId: string,
  status: "FAILED" | "CANCELED"
): Promise<void> {
  await prisma.supportPayment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status },
  });
}

/** Vérifie un paiement de support auprès de CinetPay et met la base à jour. */
export async function syncSupportPayment(
  payment: SupportPayment
): Promise<SyncResult> {
  const result = await checkCinetPayPayment(payment.providerReference);

  if (result.status === "ACCEPTED") {
    if (result.amount !== payment.amount || result.currency !== payment.currency) {
      console.error(
        `CinetPay (support) : montant ou devise inattendu pour ${payment.providerReference}`,
        { attendu: [payment.amount, payment.currency], recu: [result.amount, result.currency] }
      );
      return "mismatch";
    }

    await markSupportThreadPaid({
      threadId: payment.threadId,
      paymentId: payment.id,
      providerPayload: {
        status: "ACCEPTED",
        paymentMethod: result.paymentMethod,
        operatorId: result.operatorId,
      },
    });
    return "paid";
  }

  if (result.status === "REFUSED") {
    await markSupportPaymentFailed(payment.id, "FAILED");
    return "failed";
  }

  return "pending";
}

/** Vérifie tous les paiements récents en attente d'une conversation. */
export async function syncThreadPayments(threadId: string): Promise<void> {
  const payments = await prisma.supportPayment.findMany({
    where: {
      threadId,
      status: "PENDING",
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    take: 10,
  });

  for (const payment of payments) {
    try {
      await syncSupportPayment(payment);
    } catch (error) {
      console.error(`Vérification impossible du paiement de support ${payment.id} :`, error);
    }
  }
                                     }
