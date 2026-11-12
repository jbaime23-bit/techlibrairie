// src/app/vendeur/publication/bat-actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import { hashClientIp } from "@/lib/login-throttle";
import { inspectPrivatePdf } from "@/lib/storage";
import { INCLUDED_CORRECTION_ROUNDS } from "@/lib/edition-labels";
import {
  notifyAdminsChangesRequested,
  notifyProofApproved,
} from "@/lib/edition-notifications";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readProductId(formData: FormData): string | null {
  const value = readText(formData, "productId", 40);
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/**
 * L'auteur approuve le bon à tirer : l'ouvrage est publié, et le fichier vendu devient l'épreuve
 * (la maquette) ; le manuscrit reste archivé.
 */
export async function approveProofAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    redirect("/vendeur/produits");
  }

  const productId = readProductId(formData);
  if (!productId) {
    redirect("/vendeur/produits");
  }

  const back = `/vendeur/publication/${productId}`;

  const signature = readText(formData, "signature", 120);
  if (signature.length < 3) {
    redirect(`${back}?erreur=signature`);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${back}?erreur=confirmation`);
  }

  const proofVersion = Number.parseInt(readText(formData, "proofVersion", 6), 10);

  const project = await prisma.editionProject.findFirst({
    where: { productId, sellerId: context.seller.id },
    select: {
      id: true,
      stage: true,
      proofStorageKey: true,
      proofFileName: true,
      proofSizeBytes: true,
      proofVersion: true,
    },
  });

  if (!project || project.stage !== "PROOF_PENDING" || !project.proofStorageKey) {
    redirect(`${back}?erreur=etat`);
  }

  // Le bon à tirer approuvé doit être celui que l'auteur a sous les yeux.
  if (!Number.isInteger(proofVersion) || project.proofVersion !== proofVersion) {
    redirect(`${back}?erreur=epreuve-modifiee`);
  }

  const fee = await prisma.publicationFee.findUnique({
    where: { productId },
    select: { status: true },
  });
  if (!fee || fee.status !== "VALIDATED") {
    redirect(`${back}?erreur=forfait`);
  }

  const inspection = await inspectPrivatePdf(project.proofStorageKey);
  if (!inspection.exists || !inspection.isPdf) {
    redirect(`${back}?erreur=fichier`);
  }

  const proofKey = project.proofStorageKey;
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));

  let failure = false;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.editionProject.updateMany({
        where: { id: project.id, stage: "PROOF_PENDING", proofVersion },
        data: {
          stage: "PUBLISHED",
          approvedAt: new Date(),
          approvedByName: signature,
          approvedProofVersion: proofVersion,
          approvedIpHash: ipHash,
        },
      });

      if (claimed.count === 0) {
        throw new Error("ETAT_MODIFIE");
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          pdfStorageKey: proofKey,
          pdfFileName: project.proofFileName ?? "livre.pdf",
          pdfSizeBytes: inspection.sizeBytes ?? project.proofSizeBytes ?? 0,
        },
      });
    });
  } catch (error) {
    console.error("Approbation du bon à tirer impossible :", error);
    failure = true;
  }

  if (failure) {
    redirect(`${back}?erreur=technique`);
  }

  await notifyProofApproved(productId);

  revalidatePath("/catalogue");
  revalidatePath("/vendeur/produits");
  revalidatePath("/admin/publications");
  revalidatePath("/admin/produits");
  redirect("/vendeur/produits");
}

/** L'auteur demande des corrections sur l'épreuve (deux séries incluses dans le forfait). */
export async function requestChangesAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    redirect("/vendeur/produits");
  }

  const productId = readProductId(formData);
  if (!productId) {
    redirect("/vendeur/produits");
  }

  const back = `/vendeur/publication/${productId}`;

  const message = readText(formData, "message", 1500);
  if (message.length < 10) {
    redirect(`${back}?erreur=message`);
  }

  const proofVersion = Number.parseInt(readText(formData, "proofVersion", 6), 10);

  const project = await prisma.editionProject.findFirst({
    where: { productId, sellerId: context.seller.id },
    select: { id: true, stage: true, proofVersion: true, correctionRounds: true },
  });

  if (!project || project.stage !== "PROOF_PENDING") {
    redirect(`${back}?erreur=etat`);
  }

  if (!Number.isInteger(proofVersion) || project.proofVersion !== proofVersion) {
    redirect(`${back}?erreur=epreuve-modifiee`);
  }

  if (project.correctionRounds >= INCLUDED_CORRECTION_ROUNDS) {
    redirect(`${back}?erreur=limite`);
  }

  const claimed = await prisma.editionProject.updateMany({
    where: { id: project.id, stage: "PROOF_PENDING", proofVersion },
    data: {
      stage: "CHANGES_REQUESTED",
      correctionRounds: { increment: 1 },
      changeRequest: message,
    },
  });

  if (claimed.count === 0) {
    redirect(`${back}?erreur=etat`);
  }

  await notifyAdminsChangesRequested(productId, project.correctionRounds + 1, message);

  revalidatePath(back);
  revalidatePath("/admin/publications");
  redirect(`${back}?message=corrections`);
}
