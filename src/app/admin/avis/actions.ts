// src/app/admin/avis/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recomputeProductRating } from "@/lib/reviews";
import { recordAdminAction } from "@/lib/audit";

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function revalidateAfterChange(slug: string) {
  revalidatePath("/admin/avis");
  revalidatePath(`/catalogue/${slug}`);
  revalidatePath("/catalogue");
  revalidatePath("/");
}

/** Masque ou rend visible un avis. */
export async function setReviewStatusAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const reviewId = readId(formData, "reviewId");
  const status = formData.get("status");

  if (!reviewId || (status !== "PUBLISHED" && status !== "HIDDEN")) return;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, productId: true, product: { select: { slug: true } } },
  });
  if (!review) return;

  await prisma.review.update({ where: { id: review.id }, data: { status } });
  await recomputeProductRating(review.productId);

  await recordAdminAction(admin, {
    action: status === "HIDDEN" ? "avis.masque" : "avis.rendu_visible",
    targetType: "avis",
    targetId: review.id,
    details: { ouvrage: review.product.slug },
  });

  revalidateAfterChange(review.product.slug);
}

/** Supprime définitivement un avis. */
export async function deleteReviewAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const reviewId = readId(formData, "reviewId");
  if (!reviewId) return;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, productId: true, product: { select: { slug: true } } },
  });
  if (!review) return;

  await prisma.review.delete({ where: { id: review.id } });
  await recomputeProductRating(review.productId);

  await recordAdminAction(admin, {
    action: "avis.supprime",
    targetType: "avis",
    targetId: review.id,
    details: { ouvrage: review.product.slug },
  });

  revalidateAfterChange(review.product.slug);
}
