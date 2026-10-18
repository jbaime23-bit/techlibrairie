// src/app/avis/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  recomputeProductRating,
} from "@/lib/reviews";

const MAX_REVIEW_WRITES_PER_DAY = 20;

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

async function loadPublishedProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      status: true,
      seller: { select: { status: true } },
    },
  });

  if (!product || product.status !== "PUBLISHED" || product.seller.status !== "ACTIVE") {
    return null;
  }
  return product;
}

function revalidateProduct(slug: string) {
  revalidatePath(`/catalogue/${slug}`);
  revalidatePath("/catalogue");
  revalidatePath("/");
}

/** Publie ou modifie l'avis de l'acheteur sur un ouvrage qu'il a payé. */
export async function saveReviewAction(formData: FormData): Promise<void> {
  const productId = readId(formData, "productId");
  if (!productId) {
    redirect("/catalogue");
  }

  const product = await loadPublishedProduct(productId);
  if (!product) {
    redirect("/catalogue?erreur=produit-indisponible");
  }

  const back = `/catalogue/${product.slug}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(back)}`);
  }

  // Seuls les acheteurs d'une commande payée (non remboursée) peuvent donner leur avis.
  const purchase = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: { buyerId: user.id, status: "PAID" },
    },
    select: { id: true },
  });
  if (!purchase) {
    redirect(`${back}?avis=non-acheteur#avis`);
  }

  const rating = Number.parseInt(readText(formData, "rating", 2), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`${back}?avis=note#avis`);
  }

  const comment = readText(formData, "comment", MAX_REVIEW_LENGTH);
  if (comment.length > 0 && comment.length < MIN_REVIEW_LENGTH) {
    redirect(`${back}?avis=commentaire#avis`);
  }

  const recentWrites = await prisma.review.count({
    where: {
      userId: user.id,
      updatedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentWrites >= MAX_REVIEW_WRITES_PER_DAY) {
    redirect(`${back}?avis=limite#avis`);
  }

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId: user.id } },
    select: { id: true, status: true },
  });

  // Un avis masqué par la modération n'est plus modifiable par son auteur.
  if (existing && existing.status === "HIDDEN") {
    redirect(`${back}?avis=masque#avis`);
  }

  if (existing) {
    await prisma.review.update({
      where: { id: existing.id },
      data: { rating, comment: comment.length > 0 ? comment : null },
    });
  } else {
    await prisma.review.create({
      data: {
        productId: product.id,
        userId: user.id,
        rating,
        comment: comment.length > 0 ? comment : null,
      },
    });
  }

  await recomputeProductRating(product.id);
  revalidateProduct(product.slug);

  redirect(`${back}?avis=enregistre#avis`);
}

/** Supprime l'avis de l'acheteur connecté. */
export async function deleteOwnReviewAction(formData: FormData): Promise<void> {
  const productId = readId(formData, "productId");
  if (!productId) {
    redirect("/catalogue");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true },
  });
  if (!product) {
    redirect("/catalogue");
  }

  const back = `/catalogue/${product.slug}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(back)}`);
  }

  const deleted = await prisma.review.deleteMany({
    where: { productId: product.id, userId: user.id },
  });

  if (deleted.count > 0) {
    await recomputeProductRating(product.id);
    revalidateProduct(product.slug);
  }

  redirect(`${back}?avis=supprime#avis`);
}
