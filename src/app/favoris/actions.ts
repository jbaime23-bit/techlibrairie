// src/app/favoris/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const MAX_FAVORITES = 200;

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/** Ajoute l'ouvrage aux favoris, ou l'en retire s'il y est déjà. */
export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const productId = readId(formData, "productId");
  const from = formData.get("from") === "liste" ? "liste" : "produit";

  if (!productId) {
    redirect("/favoris");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      status: true,
      seller: { select: { status: true } },
    },
  });

  if (!product) {
    redirect("/favoris");
  }

  const back = from === "liste" ? "/favoris" : `/catalogue/${product.slug}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(back)}`);
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: user.id, productId: product.id } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    revalidatePath("/favoris");
    redirect(`${back}?favori=retire`);
  }

  const available = product.status === "PUBLISHED" && product.seller.status === "ACTIVE";
  if (!available) {
    redirect("/favoris?favori=indisponible");
  }

  const count = await prisma.favorite.count({ where: { userId: user.id } });
  if (count >= MAX_FAVORITES) {
    redirect(`${back}?favori=plein`);
  }

  try {
    await prisma.favorite.create({
      data: { userId: user.id, productId: product.id },
    });
  } catch (error) {
    // Deux clics simultanés : l'ouvrage est déjà dans les favoris, ce n'est pas une erreur.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    ) {
      console.error("Ajout aux favoris impossible :", error);
      redirect(`${back}?favori=erreur`);
    }
  }

  revalidatePath("/favoris");
  redirect(`${back}?favori=ajoute`);
}
