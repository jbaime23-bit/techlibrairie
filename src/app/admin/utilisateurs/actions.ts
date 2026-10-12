// src/app/admin/utilisateurs/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";

const BACK = "/admin/utilisateurs";

/**
 * Désactive ou réactive un compte.
 * - Un compte désactivé ne peut plus se connecter et sa session en cours est coupée aussitôt.
 * - Désactiver un vendeur suspend aussi son profil (ses ouvrages quittent le catalogue).
 * - La réactivation ne rétablit pas le profil vendeur : à faire depuis la page Vendeurs.
 */
export async function setUserActiveAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const userId = formData.get("userId");
  const activeValue = formData.get("active");

  if (typeof userId !== "string" || !/^[a-z0-9]{1,40}$/i.test(userId)) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const active = activeValue === "true";

  if (userId === admin.id) {
    redirect(`${BACK}?erreur=soi-meme`);
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, sellerProfile: { select: { id: true } } },
  });

  if (!target) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  if (target.role === "ADMIN") {
    redirect(`${BACK}?erreur=admin`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { isActive: active },
    });

    if (!active && target.sellerProfile) {
      await tx.sellerProfile.update({
        where: { id: target.sellerProfile.id },
        data: { status: "SUSPENDED" },
      });
    }
  });

  revalidatePath(BACK);
  revalidatePath("/admin/vendeurs");
  revalidatePath("/catalogue");

  redirect(`${BACK}?message=${active ? "reactive" : "desactive"}`);
}
