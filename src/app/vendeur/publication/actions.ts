// src/app/vendeur/publication/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import { hashClientIp } from "@/lib/login-throttle";
import {
  getContributionConfig,
  isContributionMethod,
  normalizePayerPhone,
  normalizeTransactionReference,
} from "@/lib/publication-fee";
import { INCLUDED_CORRECTION_ROUNDS } from "@/lib/edition-proof";
import { notifyAdminsChangesRequested, notifyProofApproved } from "@/lib/edition-notify";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** L'auteur déclare le paiement de son forfait : l'administration le vérifie ensuite. */
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
      console.error("Déclaration du forfait impossible :", error);
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

/**
 * L'auteur approuve l'épreuve (bon à tirer) : le livre est publié, et c'est le PDF mis en page qui devient
 * le fichier vendu. Le manuscrit reste conservé séparément.
 */
export async function approveProofAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    redirect("/vendeur/produits");
  }

  const productId = readText(formData, "productId", 40);
  if (!/^[a-z0-9]{1,40}$/i.test(productId)) {
    redirect("/vendeur/produits");
  }

  const back = `/vendeur/publication/${productId}`;

  if (readText(formData, "approve", 4) !== "oui") {
    redirect(`${back}?erreur=bat-case`);
  }

  const signerName = readText(formData, "signerName", 120);
  if (signerName.length < 3) {
    redirect(`${back}?erreur=bat-nom`);
  }

  const version = Number.parseInt(readText(formData, "version", 6), 10);

  const project = await prisma.editionProject.findFirst({
    where: { productId, sellerId: context.seller.id },
    select: {
      id: true,
      stage: true,
      signerEmail: true,
      proofVersion: true,
      proofStorageKey: true,
      proofFileName: true,
      proofSizeBytes: true,
    },
  });

  if (
    !project ||
    project.stage !== "PROOF_PENDING" ||
    !project.proofStorageKey ||
    !project.proofFileName ||
    project.proofSizeBytes === null
  ) {
    redirect(`${back}?erreur=bat-etat`);
  }

  if (!Number.isInteger(version) || version !== project.proofVersion) {
    redirect(`${back}?erreur=bat-version`);
  }

  const proofKey = project.proofStorageKey;
  const proofName = project.proofFileName;
  const proofSize = project.proofSizeBytes;
  const proofVersion = project.proofVersion;
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));

  const published = await prisma.$transaction(async (tx) => {
    const claimed = await tx.editionProject.updateMany({
      where: { id: project.id, stage: "PROOF_PENDING", proofVersion },
      data: {
        stage: "PUBLISHED",
        approvedAt: new Date(),
        approvedByName: signerName,
        approvedProofVersion: proofVersion,
        approvedIpHash: ipHash,
      },
    });

    if (claimed.count === 0) return false;

    await tx.product.update({
      where: { id: productId },
      data: {
        pdfStorageKey: proofKey,
        pdfFileName: proofName,
        pdfSizeBytes: proofSize,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    return true;
  });

  if (!published) {
    redirect(`${back}?erreur=bat-etat`);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { title: true, slug: true },
  });

  if (product) {
    await notifyProofApproved({
      productId,
      title: product.title,
      slug: product.slug,
      authorEmail: project.signerEmail,
      version: proofVersion,
    });
  }

  revalidatePath(back);
  revalidatePath("/vendeur/produits");
  revalidatePath("/catalogue");
  revalidatePath("/admin/editions");
  redirect(`${back}?message=publie`);
}

/** L'auteur demande des corrections sur l'épreuve (deux séries incluses dans le forfait). */
export async function requestProofChangesAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    redirect("/vendeur/produits");
  }

  const productId = readText(formData, "productId", 40);
  if (!/^[a-z0-9]{1,40}$/i.test(productId)) {
    redirect("/vendeur/produits");
  }

  const back = `/vendeur/publication/${productId}`;

  const message = readText(formData, "message", 2000);
  if (message.length < 10) {
    redirect(`${back}?erreur=corrections-texte`);
  }

  const version = Number.parseInt(readText(formData, "version", 6), 10);

  const project = await prisma.editionProject.findFirst({
    where: { productId, sellerId: context.seller.id },
    select: { id: true, stage: true, signerEmail: true, proofVersion: true, correctionRounds: true },
  });

  if (!project || project.stage !== "PROOF_PENDING") {
    redirect(`${back}?erreur=bat-etat`);
  }

  if (!Number.isInteger(version) || version !== project.proofVersion) {
    redirect(`${back}?erreur=bat-version`);
  }

  if (project.correctionRounds >= INCLUDED_CORRECTION_ROUNDS) {
    redirect(`${back}?erreur=corrections-limite`);
  }

  const claimed = await prisma.editionProject.updateMany({
    where: { id: project.id, stage: "PROOF_PENDING", proofVersion: project.proofVersion },
    data: {
      stage: "CHANGES_REQUESTED",
      correctionRounds: { increment: 1 },
      changeRequest: message,
    },
  });

  if (claimed.count === 0) {
    redirect(`${back}?erreur=bat-etat`);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { title: true },
  });

  await notifyAdminsChangesRequested({
    productId,
    title: product?.title ?? "Livre",
    authorEmail: project.signerEmail,
    round: project.correctionRounds + 1,
    message,
  });

  revalidatePath(back);
  revalidatePath("/admin/editions");
  redirect(`${back}?message=corrections`);
      }
