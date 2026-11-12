// src/app/admin/impression/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { normalizeIsbn } from "@/lib/product-validation";
import {
  MAX_PRINT_COST_XOF,
  isValidPodPackageId,
  resolvePrintStatus,
} from "@/lib/print-pricing";

const BACK = "/admin/impression";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readId(formData: FormData, name: string): string | null {
  const value = readText(formData, name, 40);
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function revalidateAll(productId: string): void {
  revalidatePath(BACK);
  revalidatePath(`/vendeur/impression/${productId}`);
  revalidatePath("/vendeur/produits");
}

/** Enregistre la configuration d'impression d'un livre de l'édition (code Lulu, pages, coût, ISBN). */
export async function savePrintConfigAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readId(formData, "productId");
  if (!productId) {
    redirect(BACK);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, kind: true, status: true, isbn: true },
  });

  if (!product || product.kind !== "BOOK_EDITION" || product.status !== "PUBLISHED") {
    redirect(`${BACK}?erreur=produit`);
  }

  // Code d'impression : facultatif à l'enregistrement, mais valide s'il est saisi.
  const podRaw = readText(formData, "podPackageId", 40).toUpperCase().replace(/\s+/g, "");
  let podPackageId: string | null = null;
  if (podRaw !== "") {
    if (!isValidPodPackageId(podRaw)) {
      redirect(`${BACK}?erreur=pod`);
    }
    podPackageId = podRaw;
  }

  const pagesRaw = readText(formData, "pageCount", 6);
  let pageCount: number | null = null;
  if (pagesRaw !== "") {
    const parsed = Number.parseInt(pagesRaw, 10);
    if (!/^\d+$/.test(pagesRaw) || parsed < 1 || parsed > 2000) {
      redirect(`${BACK}?erreur=pages`);
    }
    pageCount = parsed;
  }

  const costRaw = readText(formData, "printCostXof", 9);
  let printCostXof: number | null = null;
  if (costRaw !== "") {
    const parsed = Number.parseInt(costRaw, 10);
    if (!/^\d+$/.test(costRaw) || parsed < 1 || parsed > MAX_PRINT_COST_XOF) {
      redirect(`${BACK}?erreur=cout`);
    }
    printCostXof = parsed;
  }

  // ISBN du format imprimé : distinct de celui du PDF et unique dans le catalogue.
  const isbnRaw = readText(formData, "isbnPrint", 40);
  let isbnPrint: string | null = null;
  if (isbnRaw !== "") {
    const normalized = normalizeIsbn(isbnRaw);
    if (!normalized) {
      redirect(`${BACK}?erreur=isbn`);
    }

    const [usedByProduct, usedByPrint] = await Promise.all([
      prisma.product.findFirst({ where: { isbn: normalized }, select: { id: true } }),
      prisma.printEdition.findFirst({
        where: { isbnPrint: normalized, NOT: { productId } },
        select: { id: true },
      }),
    ]);

    if (usedByProduct || usedByPrint) {
      redirect(`${BACK}?erreur=isbn-pris`);
    }
    isbnPrint = normalized;
  }

  const existing = await prisma.printEdition.findUnique({ where: { productId } });

  const status = resolvePrintStatus({
    status: existing?.status ?? "DRAFT",
    podPackageId,
    interiorStorageKey: existing?.interiorStorageKey ?? null,
    coverStorageKey: existing?.coverStorageKey ?? null,
    printCostXof,
    retailPriceXof: existing?.retailPriceXof ?? null,
  });

  await prisma.printEdition.upsert({
    where: { productId },
    create: { productId, podPackageId, pageCount, printCostXof, isbnPrint, status },
    update: { podPackageId, pageCount, printCostXof, isbnPrint, status },
  });

  await recordAdminAction(admin, {
    action: "impression.configuree",
    targetType: "produit",
    targetId: productId,
    details: {
      titre: product.title,
      cout_fabrication_fcfa: printCostXof,
      statut: status,
    },
  });

  revalidateAll(productId);
  redirect(`${BACK}?message=configuree`);
}

/** Retire de la vente, ou remet en préparation, le format imprimé d'un livre. */
export async function setPrintStatusAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readId(formData, "productId");
  if (!productId) {
    redirect(BACK);
  }

  const intent = readText(formData, "intent", 10);
  if (intent !== "disable" && intent !== "enable") {
    redirect(BACK);
  }

  const existing = await prisma.printEdition.findUnique({ where: { productId } });
  if (!existing) {
    redirect(`${BACK}?erreur=etat`);
  }

  const status =
    intent === "disable"
      ? "DISABLED"
      : resolvePrintStatus({ ...existing, status: "DRAFT" });

  await prisma.printEdition.update({ where: { productId }, data: { status } });

  await recordAdminAction(admin, {
    action: "impression.statut_modifie",
    targetType: "produit",
    targetId: productId,
    details: { statut: status },
  });

  revalidateAll(productId);
  redirect(`${BACK}?message=statut`);
}
