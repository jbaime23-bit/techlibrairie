// src/app/vendeur/activer/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { slugWithSuffix } from "@/lib/utils";

const BACK = "/vendeur/activer";

/**
 * Crée le profil vendeur du compte connecté (administrateur ou vendeur sans profil).
 * Le rôle du compte ne change pas.
 */
export async function activateSellerProfileAction(formData: FormData): Promise<void> {
  const user = await requireRole(["SELLER", "ADMIN"], BACK);

  const existing = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) {
    redirect("/vendeur");
  }

  const rawName = formData.get("displayName");
  const rawBio = formData.get("bio");
  const displayName = typeof rawName === "string" ? rawName.trim().slice(0, 80) : "";
  const bio = typeof rawBio === "string" ? rawBio.trim().slice(0, 1000) : "";

  if (displayName.length < 2) {
    redirect(`${BACK}?erreur=nom`);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.sellerProfile.create({
        data: {
          userId: user.id,
          displayName,
          slug: slugWithSuffix(displayName),
          bio: bio || null,
        },
      });
      break;
    } catch (error) {
      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

      if (!isConflict) {
        console.error("Activation du profil vendeur impossible :", error);
        redirect(`${BACK}?erreur=technique`);
      }

      // Conflit : double clic (le profil existe déjà) ou adresse publique déjà prise.
      const nowExisting = await prisma.sellerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (nowExisting) {
        redirect("/vendeur");
      }
      if (attempt === 2) {
        redirect(`${BACK}?erreur=technique`);
      }
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/vendeur");
  redirect("/vendeur?message=profil-active");
          }
