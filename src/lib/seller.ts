// src/lib/seller.ts
// Contexte vendeur : utilisateur connecté + profil vendeur actif.

import type { SellerProfile } from "@prisma/client";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export type SellerContext =
  | { status: "unauthenticated" }
  | { status: "no-profile"; user: SessionUser }
  | { status: "suspended"; user: SessionUser; seller: SellerProfile }
  | { status: "ok"; user: SessionUser; seller: SellerProfile };

/** Lit l'utilisateur courant et son profil vendeur depuis la base. */
export async function getSellerContext(): Promise<SellerContext> {
  const user = await getCurrentUser();
  if (!user) return { status: "unauthenticated" };

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
  });

  if (!seller) return { status: "no-profile", user };
  if (seller.status !== "ACTIVE") return { status: "suspended", user, seller };

  return { status: "ok", user, seller };
}

/**
 * Pour les pages de l'espace vendeur : exige un compte vendeur ou admin,
 * puis renvoie le contexte vendeur.
 */
export async function loadSellerPage(callbackUrl: string): Promise<SellerContext> {
  await requireRole(["SELLER", "ADMIN"], callbackUrl);
  return getSellerContext();
}
