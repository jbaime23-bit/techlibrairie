// src/app/admin/droits/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";

const BACK = "/admin/droits";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readId(formData: FormData, name: string): string | null {
  const value = readText(formData, name, 40);
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function refresh(): void {
  revalidatePath(BACK);
  revalidatePath("/edition/droits");
  revalidatePath("/vendeur/revenus");
}

/** Lie un livre publié à compte d'éditeur au contrat signé de son auteur : les droits d'auteur commencent à courir. */
export async function linkRoyaltyAgreementAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readId(formData, "productId");
  const submissionId = readId(formData, "submissionId");
  if (!productId || !submissionId) {
    redirect(`${BACK}?erreur=choix`);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const [product, contract, existingForProduct, existingForContract] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, kind: true, editionModel: true },
    }),
    prisma.publisherContract.findUnique({
      where: { submissionId },
      select: {
        submissionId: true,
        sellerId: true,
        userId: true,
        royaltyPercent: true,
        version: true,
        workTitle: true,
        acceptedAt: true,
      },
    }),
    prisma.royaltyAgreement.findUnique({ where: { productId }, select: { id: true } }),
    prisma.royaltyAgreement.findUnique({ where: { submissionId }, select: { id: true } }),
  ]);

  if (!product || product.kind !== "BOOK_EDITION" || product.editionModel !== "PUBLISHER_ACCOUNT") {
    redirect(`${BACK}?erreur=livre`);
  }

  if (!contract || contract.acceptedAt === null) {
    redirect(`${BACK}?erreur=contrat`);
  }

  if (existingForProduct || existingForContract) {
    redirect(`${BACK}?erreur=deja`);
  }

  try {
    await prisma.royaltyAgreement.create({
      data: {
        productId: product.id,
        submissionId: contract.submissionId,
        authorSellerId: contract.sellerId,
        authorUserId: contract.userId,
        royaltyPercent: contract.royaltyPercent,
        contractVersion: contract.version,
        linkedBy: admin.email,
      },
    });
  } catch (error) {
    console.error("Création de l'accord de droits impossible :", error);
    redirect(`${BACK}?erreur=technique`);
  }

  await recordAdminAction(admin, {
    action: "droits.lie",
    targetType: "produit",
    targetId: product.id,
    details: {
      livre: product.title,
      contrat: contract.workTitle,
      redevance_pour_cent: contract.royaltyPercent,
    },
  });

  refresh();
  redirect(`${BACK}?message=lie`);
}

/** Délie un livre de son contrat (erreur de rattachement, ou fin du contrat) : les droits cessent de courir. */
export async function unlinkRoyaltyAgreementAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const agreementId = readId(formData, "agreementId");
  if (!agreementId) {
    redirect(BACK);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const agreement = await prisma.royaltyAgreement.findUnique({
    where: { id: agreementId },
    select: { id: true, productId: true, royaltyPercent: true },
  });

  if (!agreement) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  await prisma.royaltyAgreement.delete({ where: { id: agreement.id } });

  await recordAdminAction(admin, {
    action: "droits.delie",
    targetType: "produit",
    targetId: agreement.productId,
    details: { redevance_pour_cent: agreement.royaltyPercent },
  });

  refresh();
  redirect(`${BACK}?message=delie`);
      }
