// src/app/publier/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { slugWithSuffix } from "@/lib/utils";

const PROFILE_KEYS = ["auteur", "editeur", "vendeur"];

/**
 * Ouvre l'espace de publication d'un acheteur : crée son profil vendeur et passe son compte
 * au rôle vendeur. Le rôle étant lu dans la session à la connexion, la session actuelle est
 * invalidée (comme après un changement de mot de passe) : la personne se reconnecte aussitôt.
 */
export async function activatePublishingAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent("/publier")}`);
  }

  if (user.role !== "BUYER") {
    redirect("/publier");
  }

  const existing = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) {
    redirect("/publier");
  }

  const rawName = formData.get("displayName");
  const displayName = typeof rawName === "string" ? rawName.trim().slice(0, 80) : "";
  if (displayName.length < 2) {
    redirect("/publier?erreur=nom");
  }

  const rawProfile = formData.get("profil");
  const profile =
    typeof rawProfile === "string" && PROFILE_KEYS.includes(rawProfile) ? rawProfile : "auteur";

  let activated = false;

  for (let attempt = 0; attempt < 3 && !activated; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.user.updateMany({
          where: { id: user.id, role: "BUYER" },
          data: { role: "SELLER", passwordChangedAt: new Date() },
        });

        if (updated.count === 0) {
          throw new Error("ROLE_DEJA_MODIFIE");
        }

        await tx.sellerProfile.create({
          data: {
            userId: user.id,
            displayName,
            slug: slugWithSuffix(displayName),
          },
        });
      });

      activated = true;
    } catch (error) {
      if (error instanceof Error && error.message === "ROLE_DEJA_MODIFIE") {
        redirect("/publier");
      }

      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

      if (!isConflict) {
        console.error("Ouverture de l'espace de publication impossible :", error);
        redirect("/publier?erreur=technique");
      }

      // Conflit : double clic (le profil existe déjà) ou adresse publique déjà prise (nouvel essai).
      const nowExisting = await prisma.sellerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (nowExisting) {
        redirect("/publier");
      }
    }
  }

  if (!activated) {
    redirect("/publier?erreur=technique");
  }

  revalidatePath("/", "layout");
  redirect(`/publier/active?profil=${profile}`);
}
