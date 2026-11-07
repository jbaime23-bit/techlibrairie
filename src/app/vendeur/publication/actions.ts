// src/app/vendeur/publication/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import {
  getContributionConfig,
  isContributionMethod,
  normalizePayerPhone,
  normalizeTransactionReference,
} from "@/lib/publication-fee";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** L'auteur déclare le paiement de sa contribution : l'administration le vérifie ensuite. */
export async function declareContributionAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    redirect("/vendeur/produits");
  }

  const productId = readText(formData, "productId", 40);
  if (!/^[a-z0-9]{1,40}$/i.test(productId)) {
    redirect("/vendeur/produits");
  }

  const back = `/vendeur/publication/${productId}`;

  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: context.seller.id, status: "PENDING_PAYMENT" },
    select: { id: true, publicationFee: { select: { id: true, status: true } } },
  });

  if (!product || !product.publicationFee) {
    redirect("/vendeur/produits");
  }

  const feeStatus = product.publicationFee.status;
  if (feeStatus !== "AWAITING_PAYMENT" && feeStatus !== "REJECTED") {
    redirect(`${back}?erreur=etat`);
  }

  if (!getContributionConfig().paymentOpen) {
    redirect(`${back}?erreur=ferme`);
  }

  const method = readText(formData, "method", 20);
  if (!isContributionMethod(method)) {
    redirect(`${back}?erreur=methode`);
  }

  const payerPhone = normalizePayerPhone(readText(formData, "payerPhone", 30));
  if (!payerPhone) {
    redirect(`${back}?erreur=telephone`);
  }

  const reference = normalizeTransactionReference(readText(formData, "reference", 60));
  if (!reference) {
    redirect(`${back}?erreur=reference`);
  }

  let failure: "doublon" | "technique" | null = null;

  try {
    await prisma.publicationFee.update({
      where: { id: product.publicationFee.id },
      data: {
        status: "SUBMITTED",
        method,
        payerPhone,
        paymentReference: reference,
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });
  } catch (error) {
    const isConflict =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

    if (!isConflict) {
      console.error("Déclaration de la contribution impossible :", error);
    }
    failure = isConflict ? "doublon" : "technique";
  }

  if (failure) {
    redirect(`${back}?erreur=${failure}`);
  }

  revalidatePath(back);
  revalidatePath("/vendeur/produits");
  revalidatePath("/admin/publications");
  redirect(`${back}?message=declare`);
}
