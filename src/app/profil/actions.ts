// src/app/profil/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { newPasswordSchema } from "@/lib/account-validation";
import { deleteTokensFor } from "@/lib/account-tokens";
import { sendPasswordChangedEmail } from "@/lib/account-emails";
import {
  clearLoginFailures,
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

const BACK = "/profil";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Les mots de passe ne sont jamais "nettoyés" : les espaces en sont des caractères légitimes.
function readRaw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, 200) : "";
}

/** Modifie le nom et le téléphone du compte. */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(BACK)}`);
  }

  const name = readText(formData, "name", 80);
  const phone = readText(formData, "phone", 30);

  if (name.length < 2) {
    redirect(`${BACK}?erreur=nom`);
  }

  if (phone && !/^[+0-9 ()-]+$/.test(phone)) {
    redirect(`${BACK}?erreur=telephone`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, phone: phone ? phone : null },
  });

  revalidatePath(BACK);
  revalidatePath("/", "layout");

  redirect(`${BACK}?message=profil-modifie`);
}

/**
 * Change le mot de passe (l'ancien est exigé). Toutes les sessions ouvertes,
 * y compris celle-ci, sont ensuite refusées : l'utilisateur doit se reconnecter.
 */
export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(BACK)}`);
  }

  const currentPassword = readRaw(formData, "currentPassword");
  const newPassword = readRaw(formData, "newPassword");
  const confirmPassword = readRaw(formData, "confirmPassword");

  if (!newPasswordSchema.safeParse(newPassword).success) {
    redirect(`${BACK}?erreur=nouveau`);
  }

  if (newPassword !== confirmPassword) {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const ipHash = hashClientIp(headers().get("x-forwarded-for"));

  if (await isLoginThrottled(user.email, ipHash)) {
    redirect(`${BACK}?erreur=limite`);
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, name: true, email: true },
  });

  const currentHash = account?.passwordHash;
  if (!account || !currentHash) {
    redirect(`${BACK}?erreur=indisponible`);
  }

  const currentIsValid = await bcrypt.compare(currentPassword, currentHash);
  if (!currentIsValid) {
    await recordLoginFailure(user.email, ipHash);
    redirect(`${BACK}?erreur=mot-de-passe-actuel`);
  }

  if (await bcrypt.compare(newPassword, currentHash)) {
    redirect(`${BACK}?erreur=identique`);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  });

  // Les liens de réinitialisation encore en circulation deviennent inutilisables.
  await deleteTokensFor("reset", user.email);
  await clearLoginFailures(user.email);
  await sendPasswordChangedEmail({ email: account.email, name: account.name });

  redirect("/connexion?message=mot-de-passe-modifie");
}
