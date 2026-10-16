// src/app/admin/taux/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { RATE_BOUNDS, isForeignCurrency } from "@/lib/fx";
import { recordAdminAction } from "@/lib/audit";

/** Enregistre un nouveau taux de change (le plus récent est utilisé pour les paiements). */
export async function setExchangeRateAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const rawCurrency = formData.get("currency");
  const rawRate = formData.get("rate");

  if (typeof rawCurrency !== "string" || !isForeignCurrency(rawCurrency)) {
    redirect("/admin/taux?erreur=devise");
  }

  if (typeof rawRate !== "string") {
    redirect("/admin/taux?erreur=taux");
  }

  const normalized = rawRate.trim().replace(/\s/g, "").replace(",", ".");

  if (!/^\d{1,4}(\.\d{1,6})?$/.test(normalized)) {
    redirect("/admin/taux?erreur=taux");
  }

  const rate = Number(normalized);
  const bounds = RATE_BOUNDS[rawCurrency];

  if (!Number.isFinite(rate) || rate < bounds.min || rate > bounds.max) {
    redirect(`/admin/taux?erreur=bornes-${rawCurrency}`);
  }

  const created = await prisma.exchangeRate.create({
    data: {
      currency: rawCurrency,
      xofPerUnit: rate.toFixed(6),
      source: "Saisi par l'administrateur",
      isActive: true,
    },
  });

  await recordAdminAction(admin, {
    action: "taux.modifie",
    targetType: "taux",
    targetId: created.id,
    details: { devise: rawCurrency, taux_fcfa_pour_1: rate },
  });

  revalidatePath("/admin/taux");
  revalidatePath("/paiement");

  redirect(`/admin/taux?message=enregistre-${rawCurrency}`);
}
