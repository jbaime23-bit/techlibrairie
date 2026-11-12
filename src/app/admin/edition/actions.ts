// src/app/admin/edition/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { notifyAuthorRefused } from "@/lib/edition-notifications";

const BACK = "/admin/publications";

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/**
 * Refuse une œuvre (non-conformité) avant sa publication. L'ouvrage reste non publié.
 * Si un forfait a été déclaré ou validé, il est à rembourser (le remboursement se fait hors du site).
 */
export async function refuseEditionAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readId(formData, "productId");
  if (!productId) {
    redirect(BACK);
  }

  const rawReason = formData.get("reason");
  const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 300) : "";
  if (reason.length < 3) {
    redirect(`${BACK}?erreur=motif`);
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId },
    select: { id: true, stage: true },
  });
  if (!project) {
    redirect(BACK);
  }

  if (project.stage === "PUBLISHED" || project.stage === "REFUSED") {
    redirect(`${BACK}?erreur=etat`);
  }

  const [fee, product] = await Promise.all([
    prisma.publicationFee.findUnique({
      where: { productId },
      select: { status: true, amountXof: true },
    }),
    prisma.product.findUnique({ where: { id: productId }, select: { title: true } }),
  ]);

  const refundDue = fee !== null && (fee.status === "VALIDATED" || fee.status === "SUBMITTED");

  const claimed = await prisma.editionProject.updateMany({
    where: { id: project.id, stage: { notIn: ["PUBLISHED", "REFUSED"] } },
    data: { stage: "REFUSED", refusalReason: reason },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "edition.refusee",
    targetType: "produit",
    targetId: productId,
    details: {
      titre: product?.title ?? "",
      motif: reason,
      forfait_a_rembourser: refundDue,
      montant_fcfa: refundDue ? (fee?.amountXof ?? 0) : 0,
    },
  });

  await notifyAuthorRefused(productId, reason, refundDue);

  revalidatePath(BACK);
  revalidatePath("/admin/produits");
  revalidatePath("/vendeur/produits");
  revalidatePath(`/vendeur/publication/${productId}`);
  redirect(`${BACK}?message=refusee`);
}
