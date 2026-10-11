// src/components/paiement/auto-refresh.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recharge la page toutes les 4 secondes (20 fois au maximum) tant que le paiement est en attente. */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= 20) clearInterval(interval);
    }, 4000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
