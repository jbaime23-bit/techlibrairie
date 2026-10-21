// src/app/panier/promo-actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import {
  clearPromoCode,
  evaluatePromo,
  loadLineInputs,
  normalizePromoCode,
  setPromoCode,
} from "@/lib/promo";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

/** Applique un code promotionnel au panier (après vérification). */
export async function applyPromoAction(formData: FormData): Promise<void> {
  const raw = formData.get("code");
  const code = typeof raw === "string" ? normalizePromoCode(raw) : null;

  if (!code) {
    redirect("/panier?promo=format");
  }

  // Limitation des essais : empêche de deviner des codes par tâtonnement.
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));
  const throttleKey = `promo:${ipHash ?? "inconnu"}`;

  if (await isLoginThrottled(throttleKey, ipHash)) {
    redirect("/panier?promo=limite");
  }

  const cart = await loadCart();
  if (cart.items.length === 0 || !cart.currency) {
    redirect("/panier");
  }

  const user = await getCurrentUser();
  const lines = await loadLineInputs(cart);

  const result = await evaluatePromo({
    code,
    userId: user?.id ?? null,
    currency: cart.currency,
    lines,
  });

  if (!result.ok) {
    if (result.reason === "invalide") {
      await recordLoginFailure(throttleKey, ipHash);
    }

    const minimum = result.minAmount ? `&min=${result.minAmount}` : "";
    redirect(`/panier?promo=${result.reason}${minimum}`);
  }

  await setPromoCode(code);

  revalidatePath("/panier");
  revalidatePath("/paiement");
  redirect("/panier?promo=applique");
}

/** Retire le code promotionnel du panier. */
export async function removePromoAction(): Promise<void> {
  await clearPromoCode();

  revalidatePath("/panier");
  revalidatePath("/paiement");
  redirect("/panier?promo=retire");
}
