// src/app/admin/effacement/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { verifyAdminReauth } from "@/lib/admin-reauth";
import { eraseUserAccount } from "@/lib/account-erasure";
import { recordAdminAction } from "@/lib/audit";

const BACK = "/admin/effacement";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Les mots de passe ne sont jamais "nettoyés" : les espaces en sont des caractères légitimes.
function readRaw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, 200) : "";
}

/** Efface (anonymise) le compte d'un utilisateur à sa demande. Irréversible. */
export async function eraseAccountByAdminAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const email = readText(formData, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`${BACK}?erreur=email`);
  }

  if (formData.get("confirm") !== "oui" || readText(formData, "confirmation", 20) !== "EFFACER") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const reauth = await verifyAdminReauth(
    admin,
    readRaw(formData, "password"),
    readText(formData, "code", 20)
  );
  if (!reauth.ok) {
    redirect(`${BACK}?erreur=${reauth.reason}`);
  }

  const target = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!target) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const result = await eraseUserAccount(target.id);

  if (!result.ok) {
    redirect(`${BACK}?erreur=${result.reason}`);
  }

  // L'adresse effacée n'est pas enregistrée dans le journal : seul l'identifiant l'est.
  await recordAdminAction(admin, {
    action: "utilisateur.efface",
    targetType: "utilisateur",
    targetId: target.id,
    details: { role: result.role, commandes_conservees: result.ordersKept },
  });

  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/vendeurs");
  revalidatePath("/admin/produits");
  revalidatePath("/catalogue");

  redirect(`${BACK}?message=efface`);
      }
