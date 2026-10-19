// src/app/paiement/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { clearCartCookie } from "@/lib/cart";
import { clearPromoCode } from "@/lib/promo";

/** Vide le panier et oublie le code promotionnel une fois la commande payée (sans redirection). */
export async function clearCartAfterPaymentAction(): Promise<void> {
  await clearCartCookie();
  await clearPromoCode();
  revalidatePath("/", "layout");
}
