// src/app/profil/suppression/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { eraseUserAccount } from "@/lib/account-erasure";
import {
  clearLoginFailures,
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

const BACK = "/profil/suppression";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Les mots de passe ne sont jamais "nettoyés" : les espaces en sont des caractères légitimes.
function readRaw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, 200) : "";
}

/** Supprime (anonymise) le compte de l'utilisateur connecté, après confirmation. Irréversible. */
export async function deleteOwnAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(BACK)}`);
  }

  if (readText(formData, "confirmation", 20).toUpperCase() !== "SUPPRIMER") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const password = readRaw(formData, "password");
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));

  if (await isLoginThrottled(user.email, ipHash)) {
    redirect(`${BACK}?erreur=limite`);
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (
    !account?.passwordHash ||
    !password ||
    !(await bcrypt.compare(password, account.passwordHash))
  ) {
    await recordLoginFailure(user.email, ipHash);
    redirect(`${BACK}?erreur=mot-de-passe`);
  }

  await clearLoginFailures(user.email);

  const result = await eraseUserAccount(user.id);

  if (!result.ok) {
    redirect(`${BACK}?erreur=${result.reason}`);
  }

  redirect("/compte-supprime");
    }
