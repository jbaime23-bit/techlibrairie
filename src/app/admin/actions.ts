// src/app/admin/actions.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { deletePublicCover } from "@/lib/storage";
import { recordAdminAction } from "@/lib/audit";

const MAX_SELLER_COMMISSION_PERCENT = 90;

const PRODUCT_STATUSES = ["PUBLISHED", "UNPUBLISHED", "SUSPENDED"] as const;
const CONTACT_STATUSES = ["NEW", "READ", "ANSWERED", "ARCHIVED"] as const;

function readId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/** Suspend ou réactive un vendeur (ses ouvrages disparaissent du catalogue s'il est suspendu). */
export async function setSellerStatusAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const sellerId = readId(formData, "sellerId");
  const status = formData.get("status");

  if (!sellerId || (status !== "ACTIVE" && status !== "SUSPENDED")) return;

  const result = await prisma.sellerProfile.updateMany({
    where: { id: sellerId },
    data: { status },
  });

  if (result.count > 0) {
    await recordAdminAction(admin, {
      action: "vendeur.statut_modifie",
      targetType: "vendeur",
      targetId: sellerId,
      details: { statut: status },
    });
  }

  revalidatePath("/admin/vendeurs");
  revalidatePath("/catalogue");
}

/** Définit la commission d'un vendeur (champ vide : taux par défaut de la boutique). */
export async function setSellerCommissionAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const sellerId = readId(formData, "sellerId");
  const raw = formData.get("commissionPercent");

  if (!sellerId || typeof raw !== "string") return;

  const trimmed = raw.trim().replace(",", ".");
  let rateBps: number | null;

  if (trimmed === "") {
    rateBps = null;
  } else {
    const percent = Number(trimmed);
    if (
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > MAX_SELLER_COMMISSION_PERCENT
    ) {
      return;
    }
    rateBps = Math.round(percent * 100);
  }

  const result = await prisma.sellerProfile.updateMany({
    where: { id: sellerId },
    data: { commissionRateBps: rateBps },
  });

  if (result.count > 0) {
    await recordAdminAction(admin, {
      action: "vendeur.commission_modifiee",
      targetType: "vendeur",
      targetId: sellerId,
      details: {
        taux_pour_cent: rateBps === null ? null : rateBps / 100,
        taux_par_defaut: rateBps === null,
      },
    });
  }

  revalidatePath("/admin/vendeurs");
}

/** Publie, retire ou suspend un produit. */
export async function setProductStatusAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const productId = readId(formData, "productId");
  const status = formData.get("status");

  if (
    !productId ||
    typeof status !== "string" ||
    !(PRODUCT_STATUSES as readonly string[]).includes(status)
  ) {
    return;
  }

  const result = await prisma.product.updateMany({
    where: { id: productId },
    data: { status: status as (typeof PRODUCT_STATUSES)[number] },
  });

  if (result.count > 0) {
    await recordAdminAction(admin, {
      action: "produit.statut_modifie",
      targetType: "produit",
      targetId: productId,
      details: { statut: status },
    });
  }

  revalidatePath("/admin/produits");
  revalidatePath("/vendeur/produits");
  revalidatePath("/catalogue");
}

/** Change le statut d'un message de contact. */
export async function setContactStatusAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const messageId = readId(formData, "messageId");
  const status = formData.get("status");

  if (
    !messageId ||
    typeof status !== "string" ||
    !(CONTACT_STATUSES as readonly string[]).includes(status)
  ) {
    return;
  }

  const result = await prisma.contactMessage.updateMany({
    where: { id: messageId },
    data: { status: status as (typeof CONTACT_STATUSES)[number] },
  });

  if (result.count > 0) {
    await recordAdminAction(admin, {
      action: "contact.statut_modifie",
      targetType: "contact",
      targetId: messageId,
      details: { statut: status },
    });
  }

  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

/** Active ou désactive une publicité. */
export async function toggleAdActiveAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const adId = readId(formData, "adId");
  if (!adId) return;

  const ad = await prisma.adSpace.findUnique({
    where: { id: adId },
    select: { id: true, name: true, isActive: true },
  });
  if (!ad) return;

  await prisma.adSpace.update({
    where: { id: ad.id },
    data: { isActive: !ad.isActive },
  });

  await recordAdminAction(admin, {
    action: "publicite.basculee",
    targetType: "publicite",
    targetId: ad.id,
    details: { nom: ad.name, active: !ad.isActive },
  });

  revalidateTag("ads");
  revalidatePath("/admin/publicites");
}

/** Supprime une publicité (et l'image d'une bannière locale). */
export async function deleteAdAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const adId = readId(formData, "adId");
  if (!adId) return;

  const ad = await prisma.adSpace.findUnique({
    where: { id: adId },
    select: { id: true, name: true, kind: true, imageUrl: true },
  });
  if (!ad) return;

  await prisma.adSpace.delete({ where: { id: ad.id } });

  await recordAdminAction(admin, {
    action: "publicite.supprimee",
    targetType: "publicite",
    targetId: ad.id,
    details: { nom: ad.name, type: ad.kind },
  });

  if (ad.kind === "LOCAL_BANNER" && ad.imageUrl) {
    await deletePublicCover(ad.imageUrl).catch(() => undefined);
  }

  revalidateTag("ads");
  revalidatePath("/admin/publicites");
}
