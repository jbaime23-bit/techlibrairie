// src/app/admin/editions/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { notifyAuthorRefused } from "@/lib/edition-notify";

const BACK = "/admin/editions";

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Refuse une œuvre non conforme (contenu illicite, droits, qualité). L'auteur est prévenu.
 * Si le forfait a déjà été validé, la référence du remboursement (fait hors du site, par Mobile Money)
 * est obligatoire : elle est conservée avec le motif.
 */
export async function refuseEditionAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readId(formData, "productId");
  if (!productId) {
    redirect(BACK);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const reason = readText(formData, "reason", 300);
  if (reason.length < 3) {
    redirect(`${BACK}?erreur=motif`);
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId },
    select: { id: true, stage: true, signerEmail: true },
  });
  if (!project || project.stage === "PUBLISHED" || project.stage === "REFUSED") {
    redirect(`${BACK}?erreur=etat`);
  }

  const [fee, product] = await Promise.all([
    prisma.publicationFee.findUnique({
      where: { productId },
      select: { status: true, amountXof: true },
    }),
    prisma.product.findUnique({ where: { id: productId }, select: { title: true } }),
  ]);

  let refundReference: string | null = null;
  if (fee?.status === "VALIDATED") {
    refundReference = readText(formData, "refundReference", 100);
    if (refundReference.length < 3) {
      redirect(`${BACK}?erreur=remboursement`);
    }
  }

  const fullReason = refundReference
    ? `${reason} (forfait remboursé, référence : ${refundReference})`
    : reason;

  const claimed = await prisma.editionProject.updateMany({
    where: { id: project.id, stage: { notIn: ["PUBLISHED", "REFUSED"] } },
    data: { stage: "REFUSED", refusalReason: fullReason },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  const title = product?.title ?? "Votre livre";

  await recordAdminAction(admin, {
    action: "edition.refusee",
    targetType: "produit",
    targetId: productId,
    details: {
      titre: title,
      motif: reason,
      remboursement: refundReference,
      montant_fcfa: fee?.status === "VALIDATED" ? fee.amountXof : null,
    },
  });

  await notifyAuthorRefused({
    to: project.signerEmail,
    productId,
    title,
    reason: fullReason,
  });

  revalidatePath(BACK);
  revalidatePath("/admin/publications");
  revalidatePath(`/vendeur/publication/${productId}`);
  redirect(`${BACK}?message=refusee`);
}
