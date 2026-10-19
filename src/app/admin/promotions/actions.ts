// src/app/admin/promotions/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { normalizePromoCode } from "@/lib/promo";

const BACK = "/admin/promotions";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/** Nombre entier saisi : null si le champ est vide, NaN s'il est invalide. */
function readInteger(formData: FormData, name: string): number | null {
  const raw = readText(formData, name, 12);
  if (raw === "") return null;
  return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : Number.NaN;
}

/** Date AAAA-MM-JJ : null si vide, undefined si invalide. */
function readDay(formData: FormData, name: string): Date | null | undefined {
  const raw = readText(formData, name, 10);
  if (raw === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;

  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    return undefined;
  }
  return date;
}

/** Crée un code promotionnel. */
export async function createPromoAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const code = normalizePromoCode(readText(formData, "code", 40));
  if (!code) {
    redirect(`${BACK}?erreur=code`);
  }

  const type = formData.get("type");
  if (type !== "PERCENT" && type !== "FIXED") {
    redirect(`${BACK}?erreur=type`);
  }

  const value = readInteger(formData, "value");
  if (value === null || Number.isNaN(value)) {
    redirect(`${BACK}?erreur=valeur`);
  }
  if (type === "PERCENT" && (value < 1 || value > 90)) {
    redirect(`${BACK}?erreur=pourcentage`);
  }
  if (type === "FIXED" && (value < 100 || value > 1_000_000 || value % 5 !== 0)) {
    redirect(`${BACK}?erreur=montant`);
  }

  const bearer = formData.get("bearer");
  if (bearer !== "PROPORTIONAL" && bearer !== "SHOP") {
    redirect(`${BACK}?erreur=repartition`);
  }

  const minOrder = readInteger(formData, "minOrder");
  if (minOrder !== null && (Number.isNaN(minOrder) || minOrder > 10_000_000)) {
    redirect(`${BACK}?erreur=minimum`);
  }

  const startsAt = readDay(formData, "startsAt");
  const endsAt = readDay(formData, "endsAt");
  if (startsAt === undefined || endsAt === undefined) {
    redirect(`${BACK}?erreur=dates`);
  }
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    redirect(`${BACK}?erreur=dates`);
  }

  const maxRedemptions = readInteger(formData, "maxRedemptions");
  if (
    maxRedemptions !== null &&
    (Number.isNaN(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1_000_000)
  ) {
    redirect(`${BACK}?erreur=limite-totale`);
  }

  const maxPerUser = readInteger(formData, "maxPerUser") ?? 1;
  if (Number.isNaN(maxPerUser) || maxPerUser < 1 || maxPerUser > 100) {
    redirect(`${BACK}?erreur=limite-acheteur`);
  }

  const description = readText(formData, "description", 120);

  let createdId: string;
  try {
    const created = await prisma.promoCode.create({
      data: {
        code,
        description: description || null,
        type,
        value,
        bearer,
        minOrderAmountXof: minOrder ?? 0,
        startsAt,
        // La date de fin est incluse : le code reste valable toute cette journée.
        endsAt: endsAt ? new Date(endsAt.getTime() + 24 * 60 * 60 * 1000 - 1) : null,
        maxRedemptions,
        maxPerUser,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect(`${BACK}?erreur=existe`);
    }
    console.error("Création du code promotionnel impossible :", error);
    redirect(`${BACK}?erreur=technique`);
  }

  await recordAdminAction(admin, {
    action: "promo.cree",
    targetType: "promo",
    targetId: createdId,
    details: {
      code,
      type,
      valeur: value,
      repartition: bearer,
      minimum_fcfa: minOrder ?? 0,
      utilisations_max: maxRedemptions,
      par_acheteur: maxPerUser,
    },
  });

  revalidatePath(BACK);
  redirect(`${BACK}?message=cree`);
}

/** Active ou désactive un code. */
export async function togglePromoAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const promoId = readId(formData, "promoId");
  if (!promoId) {
    redirect(BACK);
  }

  const promo = await prisma.promoCode.findUnique({
    where: { id: promoId },
    select: { id: true, code: true, isActive: true },
  });
  if (!promo) {
    redirect(BACK);
  }

  await prisma.promoCode.update({
    where: { id: promo.id },
    data: { isActive: !promo.isActive },
  });

  await recordAdminAction(admin, {
    action: "promo.bascule",
    targetType: "promo",
    targetId: promo.id,
    details: { code: promo.code, actif: !promo.isActive },
  });

  revalidatePath(BACK);
  redirect(BACK);
}

/** Supprime un code jamais utilisé (un code utilisé se désactive, pour garder l'historique). */
export async function deletePromoAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const promoId = readId(formData, "promoId");
  if (!promoId) {
    redirect(BACK);
  }

  const promo = await prisma.promoCode.findUnique({
    where: { id: promoId },
    select: { id: true, code: true },
  });
  if (!promo) {
    redirect(BACK);
  }

  const usedBy = await prisma.order.count({ where: { promoCodeId: promo.id } });
  if (usedBy > 0) {
    redirect(`${BACK}?erreur=utilise`);
  }

  await prisma.promoCode.delete({ where: { id: promo.id } });

  await recordAdminAction(admin, {
    action: "promo.supprime",
    targetType: "promo",
    targetId: promo.id,
    details: { code: promo.code },
  });

  revalidatePath(BACK);
  redirect(`${BACK}?message=supprime`);
}
