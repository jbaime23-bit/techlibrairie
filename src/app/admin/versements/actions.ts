// src/app/admin/versements/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";

const BACK = "/admin/versements";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readPayoutId(formData: FormData): string | null {
  const id = readText(formData, "payoutId", 40);
  return /^[a-z0-9]{1,40}$/i.test(id) ? id : null;
}

/** Prend en charge une demande (en attente vers en cours de traitement). */
export async function startPayoutAction(formData: FormData): Promise<void> {
  await assertAdminAction();

  const payoutId = readPayoutId(formData);
  if (!payoutId) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const result = await prisma.payout.updateMany({
    where: { id: payoutId, status: "PENDING" },
    data: { status: "PROCESSING" },
  });

  revalidatePath(BACK);
  revalidatePath("/vendeur/revenus");

  redirect(result.count > 0 ? `${BACK}?message=pris-en-charge` : `${BACK}?erreur=etat`);
}

/** Marque une demande comme versée, avec la référence de la transaction Mobile Money. */
export async function markPayoutPaidAction(formData: FormData): Promise<void> {
  await assertAdminAction();

  const payoutId = readPayoutId(formData);
  if (!payoutId) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const reference = readText(formData, "reference", 100);
  if (!/^[A-Za-z0-9 _./-]{3,100}$/.test(reference)) {
    redirect(`${BACK}?erreur=reference`);
  }

  const result = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "PAID", paidAt: new Date(), reference },
  });

  revalidatePath(BACK);
  revalidatePath("/vendeur/revenus");

  redirect(result.count > 0 ? `${BACK}?message=paye` : `${BACK}?erreur=etat`);
}

/** Refuse une demande (les fonds redeviennent disponibles pour le vendeur). */
export async function rejectPayoutAction(formData: FormData): Promise<void> {
  await assertAdminAction();

  const payoutId = readPayoutId(formData);
  if (!payoutId) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const reason = readText(formData, "reason", 200);
  if (reason.length < 3) {
    redirect(`${BACK}?erreur=motif`);
  }

  const payout = await prisma.payout.findFirst({
    where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true, note: true },
  });

  if (!payout) {
    redirect(`${BACK}?erreur=etat`);
  }

  const result = await prisma.payout.updateMany({
    where: { id: payout.id, status: { in: ["PENDING", "PROCESSING"] } },
    data: {
      status: "FAILED",
      note: `${payout.note ? `${payout.note} | ` : ""}Refusé : ${reason}`,
    },
  });

  revalidatePath(BACK);
  revalidatePath("/vendeur/revenus");

  redirect(result.count > 0 ? `${BACK}?message=refuse` : `${BACK}?erreur=etat`);
}
