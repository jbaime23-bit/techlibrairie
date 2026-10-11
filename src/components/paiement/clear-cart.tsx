// src/components/paiement/clear-cart.tsx
"use client";

import { useEffect } from "react";
import { clearCartAfterPaymentAction } from "@/app/paiement/actions";

/** Vide le panier dès que la commande est confirmée comme payée. */
export function ClearCart() {
  useEffect(() => {
    void clearCartAfterPaymentAction();
  }, []);

  return null;
}
