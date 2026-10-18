// src/lib/reviews.ts
// Avis et notes : recalcul de la note moyenne et affichage du nom de l'auteur.
// La note moyenne et le nombre d'avis sont stockés sur Product (ratingAverage, ratingCount)
// et recalculés à chaque création, modification, masquage ou suppression d'un avis.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MAX_REVIEW_LENGTH = 1000;
export const MIN_REVIEW_LENGTH = 5;

/** Recalcule la note moyenne et le nombre d'avis publiés d'un ouvrage. */
export async function recomputeProductRating(
  productId: string,
  client: Prisma.TransactionClient = prisma
): Promise<void> {
  const aggregate = await client.review.aggregate({
    where: { productId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const average = aggregate._avg.rating ?? 0;

  await client.product.update({
    where: { id: productId },
    data: {
      ratingAverage: Math.round(average * 100) / 100,
      ratingCount: aggregate._count._all,
    },
  });
}

/** Nom affiché publiquement : prénom et initiale du nom, ex. "Awa K.". */
export function publicReviewerName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "Acheteur";

  const first = parts[0].slice(0, 30);
  if (parts.length === 1) return first;

  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export const REVIEW_STATUS_LABELS = {
  PUBLISHED: "Publié",
  HIDDEN: "Masqué",
} as const;
