// src/app/vendeur/profil/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";

const BACK = "/vendeur/profil";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Modifie le nom public et la présentation du vendeur. */
export async function updateSellerProfileAction(formData: FormData): Promise<void> {
  const context = await getSellerContext();

  if (context.status === "unauthenticated") {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(BACK)}`);
  }
  if (context.status !== "ok") {
    redirect(`${BACK}?erreur=compte`);
  }

  const displayName = readText(formData, "displayName", 80);
  const bio = readText(formData, "bio", 1000);

  if (displayName.length < 2) {
    redirect(`${BACK}?erreur=nom`);
  }

  await prisma.sellerProfile.update({
    where: { id: context.seller.id },
    data: { displayName, bio: bio ? bio : null },
  });

  revalidatePath(BACK);
  revalidatePath("/vendeur");
  revalidatePath("/catalogue");
  revalidatePath(`/auteurs/${context.seller.slug}`);

  redirect(`${BACK}?message=enregistre`);
}
