// src/app/panier/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  MAX_CART_ITEMS,
  clearCartCookie,
  getCartIds,
  writeCartIds,
} from "@/lib/cart";
import { clearPromoCode } from "@/lib/promo";

export async function addToCartAction(formData: FormData): Promise<void> {
  const productId = formData.get("productId");

  if (typeof productId !== "string" || productId.length === 0) {
    redirect("/catalogue");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      currency: true,
      status: true,
      seller: { select: { status: true, userId: true } },
    },
  });

  if (
    !product ||
    product.status !== "PUBLISHED" ||
    product.seller.status !== "ACTIVE"
  ) {
    redirect("/catalogue?erreur=produit-indisponible");
  }

  const user = await getCurrentUser();

  if (user) {
    // Un vendeur ne peut pas acheter son propre ouvrage.
    if (product.seller.userId === user.id) {
      redirect(`/catalogue/${product.slug}?erreur=votre-ouvrage`);
    }

    // Un ouvrage déjà acheté ne peut pas être racheté.
    const alreadyBought = await prisma.orderItem.findFirst({
      where: {
        productId: product.id,
        order: { buyerId: user.id, status: "PAID" },
      },
      select: { id: true },
    });
    if (alreadyBought) {
      redirect(`/catalogue/${product.slug}?erreur=deja-achete`);
    }
  }

  const ids = await getCartIds();

  if (!ids.includes(product.id)) {
    if (ids.length >= MAX_CART_ITEMS) {
      redirect(`/catalogue/${product.slug}?erreur=panier-plein`);
    }

    if (ids.length > 0) {
      const existing = await prisma.product.findFirst({
        where: { id: { in: ids }, status: "PUBLISHED" },
        select: { currency: true },
      });
      if (existing && existing.currency !== product.currency) {
        redirect(`/catalogue/${product.slug}?erreur=devise-differente`);
      }
    }

    await writeCartIds([...ids, product.id]);
  }

  revalidatePath("/", "layout");
  redirect("/panier");
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const productId = formData.get("productId");

  if (typeof productId === "string" && productId.length > 0) {
    const remaining = (await getCartIds()).filter((id) => id !== productId);
    if (remaining.length === 0) {
      await clearCartCookie();
      await clearPromoCode();
    } else {
      await writeCartIds(remaining);
    }
  }

  revalidatePath("/", "layout");
  redirect("/panier");
}

export async function clearCartAction(): Promise<void> {
  await clearCartCookie();
  await clearPromoCode();
  revalidatePath("/", "layout");
  redirect("/panier");
        }
