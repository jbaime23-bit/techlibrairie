// src/app/paiement/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { clearCartCookie } from "@/lib/cart";

/** Vide le panier une fois la commande payée (sans redirection). */
export async function clearCartAfterPaymentAction(): Promise<void> {
  clearCartCookie();
  revalidatePath("/", "layout");
}
