// src/app/vendeur/impression/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import { MAX_PRINT_PRICE_XOF, printPriceFloorXof } from "@/lib/print-pricing";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readProductId(formData: FormData): string | null {
  const value = readText(formData, "productId", 40);
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/** L'auteur fixe le prix public de son exemplaire imprimé (au moins le prix plancher) : le format est proposé. */
export async function setPrintPriceAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    redirect("/vendeur/produits");
  }

  const productId = readProductId(formData);
  if (!productId) {
    redirect("/vendeur/produits");
  }

  const back = `/vendeur/impression/${productId}`;

  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: context.seller.id, kind: "BOOK_EDITION", status: "PUBLISHED" },
    select: { id: true },
  });
  if (!product) {
    redirect("/vendeur/produits");
  }

  const edition = await prisma.printEdition.findUnique({ where: { productId } });
  if (
    !edition ||
    (edition.status !== "READY" && edition.status !== "ACTIVE") ||
    edition.printCostXof === null
  ) {
    redirect(`${back}?erreur=etat`);
  }

  const raw = readText(formData, "price", 9);
  const price = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : Number.NaN;

  if (!Number.isInteger(price) || price % 5 !== 0 || price > MAX_PRINT_PRICE_XOF) {
    redirect(`${back}?erreur=prix`);
  }

  if (price < printPriceFloorXof(edition.printCostXof)) {
    redirect(`${back}?erreur=plancher`);
  }

  await prisma.printEdition.update({
    where: { productId },
    data: { retailPriceXof: price, status: "ACTIVE" },
  });

  revalidatePath(back);
  revalidatePath("/vendeur/produits");
  revalidatePath("/admin/impression");
  redirect(`${back}?message=prix`);
}

/** L'auteur suspend lui-même la vente de son exemplaire imprimé (son prix est conservé). */
export async function suspendPrintAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    redirect("/vendeur/produits");
  }

  const productId = readProductId(formData);
  if (!productId) {
    redirect("/vendeur/produits");
  }

  const back = `/vendeur/impression/${productId}`;

  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: context.seller.id, kind: "BOOK_EDITION" },
    select: { id: true },
  });
  if (!product) {
    redirect("/vendeur/produits");
  }

  await prisma.printEdition.updateMany({
    where: { productId, status: "ACTIVE" },
    data: { status: "READY" },
  });

  revalidatePath(back);
  revalidatePath("/vendeur/produits");
  revalidatePath("/admin/impression");
  redirect(`${back}?message=suspendu`);
}
