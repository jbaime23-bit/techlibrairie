// src/app/admin/mise-en-ligne/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { EditionModel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { inspectPrivatePdf } from "@/lib/storage";
import {
  notifySellerProductPublished,
  notifySellerProductRejected,
} from "@/lib/publication-notifications";

const BACK = "/admin/mise-en-ligne";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readProductId(formData: FormData): string | null {
  const value = readText(formData, "productId", 40);
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function readModel(formData: FormData): EditionModel | null {
  const value = readText(formData, "model", 30);
  return value === "AUTHOR_ACCOUNT" || value === "PUBLISHER_ACCOUNT" ? value : null;
}

function refresh(slug?: string): void {
  revalidatePath(BACK);
  revalidatePath("/admin/produits");
  revalidatePath("/admin/publications");
  revalidatePath("/vendeur/produits");
  revalidatePath("/catalogue");
  revalidatePath("/boutique");
  if (slug) revalidatePath(`/catalogue/${slug}`);
}

/**
 * Valide et met en ligne un ouvrage déposé (en attente de validation) : un PDF simple, ou un livre déposé
 * par un administrateur (le badge est alors à choisir).
 */
export async function publishPendingProductAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readProductId(formData);
  if (!productId) {
    redirect(BACK);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, slug: true, kind: true, status: true },
  });

  if (!product || product.status !== "PENDING_REVIEW") {
    redirect(`${BACK}?erreur=etat`);
  }

  const isBook = product.kind === "BOOK_EDITION";
  const model = isBook ? readModel(formData) : null;

  if (isBook && !model) {
    redirect(`${BACK}?erreur=badge`);
  }

  const now = new Date();

  const claimed = await prisma.product.updateMany({
    where: { id: product.id, status: "PENDING_REVIEW" },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
      validatedAt: now,
      editionModel: model,
    },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "produit.mis_en_ligne",
    targetType: "produit",
    targetId: product.id,
    details: {
      titre: product.title,
      service: isBook ? "livre édité" : "PDF simple",
      badge: model,
    },
  });

  await notifySellerProductPublished(product.id);

  refresh(product.slug);
  redirect(`${BACK}?message=publie`);
}

/** Refuse un ouvrage en attente : il reste invisible (suspendu) et le vendeur en est informé. */
export async function rejectPendingProductAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readProductId(formData);
  if (!productId) {
    redirect(BACK);
  }

  const reason = readText(formData, "reason", 300);
  if (reason.length < 10) {
    redirect(`${BACK}?erreur=motif`);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, status: true },
  });

  if (!product || product.status !== "PENDING_REVIEW") {
    redirect(`${BACK}?erreur=etat`);
  }

  const claimed = await prisma.product.updateMany({
    where: { id: product.id, status: "PENDING_REVIEW" },
    data: { status: "SUSPENDED" },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "produit.refuse",
    targetType: "produit",
    targetId: product.id,
    details: { titre: product.title, motif: reason },
  });

  await notifySellerProductRejected(product.id, reason);

  refresh();
  redirect(`${BACK}?message=refuse`);
}

/**
 * Met en ligne un livre dont l'auteur a approuvé le bon à tirer : le fichier vendu devient l'épreuve
 * approuvée (le manuscrit reste archivé), avec le badge choisi.
 */
export async function publishEditedBookAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readProductId(formData);
  if (!productId) {
    redirect(BACK);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const model = readModel(formData);
  if (!model) {
    redirect(`${BACK}?erreur=badge`);
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId },
    select: {
      id: true,
      stage: true,
      proofStorageKey: true,
      proofFileName: true,
      proofSizeBytes: true,
    },
  });

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, slug: true, status: true },
  });

  if (
    !project ||
    !product ||
    project.stage !== "READY_TO_PUBLISH" ||
    product.status !== "PENDING_PAYMENT" ||
    !project.proofStorageKey
  ) {
    redirect(`${BACK}?erreur=etat`);
  }

  const fee = await prisma.publicationFee.findUnique({
    where: { productId },
    select: { status: true },
  });
  if (!fee || fee.status !== "VALIDATED") {
    redirect(`${BACK}?erreur=forfait`);
  }

  const inspection = await inspectPrivatePdf(project.proofStorageKey);
  if (!inspection.exists || !inspection.isPdf) {
    redirect(`${BACK}?erreur=fichier`);
  }

  const proofKey = project.proofStorageKey;
  const now = new Date();
  let failure = false;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.editionProject.updateMany({
        where: { id: project.id, stage: "READY_TO_PUBLISH" },
        data: { stage: "PUBLISHED" },
      });

      if (claimed.count === 0) {
        throw new Error("ETAT_MODIFIE");
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          validatedAt: now,
          editionModel: model,
          pdfStorageKey: proofKey,
          pdfFileName: project.proofFileName ?? "livre.pdf",
          pdfSizeBytes: inspection.sizeBytes ?? project.proofSizeBytes ?? 0,
        },
      });
    });
  } catch (error) {
    console.error("Mise en ligne du livre impossible :", error);
    failure = true;
  }

  if (failure) {
    redirect(`${BACK}?erreur=technique`);
  }

  await recordAdminAction(admin, {
    action: "edition.mise_en_ligne",
    targetType: "produit",
    targetId: productId,
    details: { titre: product.title, badge: model },
  });

  await notifySellerProductPublished(productId);

  refresh(product.slug);
  redirect(`${BACK}?message=livre-publie`);
    }
