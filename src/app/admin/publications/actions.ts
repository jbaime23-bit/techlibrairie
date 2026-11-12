// src/app/admin/publications/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import {
  notifyAuthorFeeRejected,
  notifyAuthorFeeValidated,
} from "@/lib/edition-notifications";

const BACK = "/admin/publications";

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function revalidateAll(): void {
  revalidatePath(BACK);
  revalidatePath("/admin/produits");
  revalidatePath("/vendeur/produits");
  revalidatePath("/catalogue");
}

/**
 * Valide le paiement du forfait d'édition.
 * - Édition à compte d'auteur (projet existant) : l'ouvrage passe « En maquette » ; il n'est PAS publié
 *   (il ne le sera qu'après le bon à tirer approuvé par l'auteur).
 * - Ancien dépôt sans projet : l'ouvrage est publié comme avant.
 */
export async function validatePublicationAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const feeId = readId(formData, "feeId");
  if (!feeId) {
    redirect(BACK);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const fee = await prisma.publicationFee.findUnique({
    where: { id: feeId },
    select: {
      id: true,
      amountXof: true,
      paymentReference: true,
      productId: true,
      product: { select: { title: true } },
    },
  });
  if (!fee) {
    redirect(BACK);
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId: fee.productId },
    select: { id: true, stage: true },
  });

  // Une œuvre refusée ne peut plus avancer.
  if (project?.stage === "REFUSED") {
    redirect(`${BACK}?erreur=etat`);
  }

  // Verrou logique : seule la première validation d'un paiement déclaré est prise en compte.
  const claimed = await prisma.publicationFee.updateMany({
    where: { id: fee.id, status: "SUBMITTED" },
    data: {
      status: "VALIDATED",
      validatedAt: new Date(),
      validatedBy: admin.email,
      rejectionReason: null,
    },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  if (project) {
    await prisma.editionProject.updateMany({
      where: { id: project.id, stage: "FEE_PENDING" },
      data: { stage: "IN_LAYOUT" },
    });
  } else {
    await prisma.product.updateMany({
      where: { id: fee.productId, status: "PENDING_PAYMENT" },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  }

  await recordAdminAction(admin, {
    action: "publication.validee",
    targetType: "produit",
    targetId: fee.productId,
    details: {
      titre: fee.product.title,
      montant_fcfa: fee.amountXof,
      reference: fee.paymentReference,
      suite: project ? "maquette" : "publication",
    },
  });

  if (project) {
    await notifyAuthorFeeValidated(fee.productId);
  }

  revalidateAll();
  redirect(`${BACK}?message=${project ? "validee-maquette" : "validee"}`);
}

/** Rejette un paiement déclaré (non retrouvé, montant insuffisant) : l'auteur peut déclarer à nouveau. */
export async function rejectPublicationAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const feeId = readId(formData, "feeId");
  if (!feeId) {
    redirect(BACK);
  }

  const rawReason = formData.get("reason");
  const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 200) : "";
  if (reason.length < 3) {
    redirect(`${BACK}?erreur=motif`);
  }

  const fee = await prisma.publicationFee.findUnique({
    where: { id: feeId },
    select: {
      id: true,
      amountXof: true,
      paymentReference: true,
      productId: true,
      product: { select: { title: true } },
    },
  });
  if (!fee) {
    redirect(BACK);
  }

  const claimed = await prisma.publicationFee.updateMany({
    where: { id: fee.id, status: "SUBMITTED" },
    data: { status: "REJECTED", rejectionReason: reason },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "publication.rejetee",
    targetType: "produit",
    targetId: fee.productId,
    details: {
      titre: fee.product.title,
      montant_fcfa: fee.amountXof,
      reference: fee.paymentReference,
      motif: reason,
    },
  });

  await notifyAuthorFeeRejected(fee.productId, reason);

  revalidateAll();
  redirect(`${BACK}?message=rejetee`);
}
