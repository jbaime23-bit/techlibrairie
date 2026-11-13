// src/app/acheteur/impression/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdminsPrintPaymentDeclared } from "@/lib/print-order-notifications";
import {
  getContributionConfig,
  normalizePayerPhone,
  normalizeTransactionReference,
} from "@/lib/publication-fee";

const METHODS = ["ORANGE_MONEY", "MOOV_MONEY", "AUTRE"];

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** L'acheteur déclare le paiement de sa commande imprimée : l'administration le vérifie ensuite. */
export async function declarePrintPaymentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion");
  }

  const number = readText(formData, "number", 20);
  if (!/^LI-[A-Z0-9]{8}$/.test(number)) {
    redirect("/acheteur/impression");
  }

  const back = `/acheteur/impression/${number}`;

  const order = await prisma.printOrder.findFirst({
    where: { number, buyerId: user.id },
    select: { id: true, status: true },
  });

  if (!order) {
    redirect("/acheteur/impression");
  }
  if (order.status !== "AWAITING_PAYMENT") {
    redirect(`${back}?erreur=etat`);
  }

  const method = readText(formData, "method", 20);
  if (!METHODS.includes(method)) {
    redirect(`${back}?erreur=methode`);
  }

  const rawPayer = readText(formData, "payer", 60);
  const payer = method === "AUTRE" ? (rawPayer.length >= 3 ? rawPayer : null) : normalizePayerPhone(rawPayer);
  if (!payer) {
    redirect(`${back}?erreur=expediteur`);
  }

  const reference = normalizeTransactionReference(readText(formData, "reference", 60));
  if (!reference) {
    redirect(`${back}?erreur=reference`);
  }

  if (method !== "AUTRE" && !getContributionConfig().paymentOpen) {
    redirect(`${back}?erreur=ferme`);
  }

  let failure: "doublon" | "technique" | null = null;

  try {
    const claimed = await prisma.printOrder.updateMany({
      where: { id: order.id, status: "AWAITING_PAYMENT" },
      data: {
        status: "PAYMENT_SUBMITTED",
        paymentMethod: method,
        payerPhone: payer,
        paymentReference: reference,
        paymentSubmittedAt: new Date(),
        paymentRejectionReason: null,
      },
    });

    if (claimed.count === 0) {
      redirect(`${back}?erreur=etat`);
    }
  } catch (error) {
    // Les redirections de Next.js sont des exceptions : on les laisse passer.
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    if (typeof error === "object" && error !== null && "digest" in error) {
      throw error;
    }

    const isConflict =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

    if (!isConflict) {
      console.error("Déclaration du paiement imprimé impossible :", error);
    }
    failure = isConflict ? "doublon" : "technique";
  }

  if (failure) {
    redirect(`${back}?erreur=${failure}`);
  }

  await notifyAdminsPrintPaymentDeclared(order.id);

  revalidatePath(back);
  revalidatePath("/admin/impressions");
  redirect(`${back}?message=declare`);
  }
