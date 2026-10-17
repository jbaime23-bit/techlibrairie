// src/app/profil/email/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { verifyAdminReauth } from "@/lib/admin-reauth";
import { ERASED_EMAIL_DOMAIN } from "@/lib/account-erasure";
import {
  changePayload,
  createAccountToken,
  deleteChangeTokensForUser,
  deleteTokensFor,
  findValidToken,
  parseChangePayload,
} from "@/lib/account-tokens";
import {
  sendEmailChangeConfirmationEmail,
  sendEmailChangeNoticeEmail,
  sendEmailChangedEmail,
} from "@/lib/account-emails";
import { isEmailConfigured } from "@/lib/email";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { recordAdminAction } from "@/lib/audit";

const BACK = "/profil/email";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUESTS_PER_DAY = 10;

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Les mots de passe ne sont jamais "nettoyés" : les espaces en sont des caractères légitimes.
function readRaw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, 200) : "";
}

/** Demande un changement d'adresse : un lien de confirmation part vers la nouvelle adresse. */
export async function requestEmailChangeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(BACK)}`);
  }

  const newEmail = readText(formData, "newEmail", 254).toLowerCase();

  if (!EMAIL_REGEX.test(newEmail) || newEmail.endsWith(`@${ERASED_EMAIL_DOMAIN}`)) {
    redirect(`${BACK}?erreur=email`);
  }

  if (newEmail === user.email.toLowerCase()) {
    redirect(`${BACK}?erreur=identique`);
  }

  if (!isEmailConfigured()) {
    redirect(`${BACK}?erreur=indisponible`);
  }

  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));
  const requestKey = `emailchange:${user.id}`;

  // Limites de fréquence propres à cette fonction.
  if (await isLoginThrottled(requestKey, ipHash)) {
    redirect(`${BACK}?erreur=limite`);
  }

  const requestsToday = await prisma.loginAttempt.count({
    where: {
      email: requestKey,
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (requestsToday >= MAX_REQUESTS_PER_DAY) {
    redirect(`${BACK}?erreur=limite`);
  }

  // Nouvelle vérification d'identité : mot de passe (+ code pour un administrateur).
  const password = readRaw(formData, "password");

  if (user.role === "ADMIN") {
    const reauth = await verifyAdminReauth(
      { id: user.id, email: user.email },
      password,
      readText(formData, "code", 20)
    );
    if (!reauth.ok) {
      redirect(`${BACK}?erreur=${reauth.reason}`);
    }
  } else {
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
  }

  const existing = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (existing) {
    redirect(`${BACK}?erreur=utilisee`);
  }

  // Chaque demande valide est comptée.
  await recordLoginFailure(requestKey, ipHash);

  await deleteChangeTokensForUser(user.id);
  const token = await createAccountToken("change", changePayload(user.id, newEmail));

  const sent = await sendEmailChangeConfirmationEmail({
    newEmail,
    name: user.name,
    token,
  });

  if (!sent.ok) {
    await deleteChangeTokensForUser(user.id);
    redirect(`${BACK}?erreur=envoi`);
  }

  // Alerte à l'ancienne adresse (au mieux : un échec n'annule pas la demande).
  await sendEmailChangeNoticeEmail({
    oldEmail: user.email,
    name: user.name,
    newEmail,
  });

  redirect(`${BACK}?message=envoye&destinataire=${encodeURIComponent(newEmail)}`);
}

/** Confirme le changement d'adresse à partir du lien reçu (utilisateur connecté, bon compte). */
export async function confirmEmailChangeAction(formData: FormData): Promise<void> {
  const token = readText(formData, "token", 100);

  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/connexion?callbackUrl=${encodeURIComponent(`/profil/email/confirmer?token=${token}`)}`
    );
  }

  const valid = await findValidToken("change", token);
  const payload = valid ? parseChangePayload(valid.email) : null;

  if (!payload || payload.userId !== user.id) {
    redirect(`${BACK}?erreur=lien`);
  }

  const taken = await prisma.user.findUnique({
    where: { email: payload.newEmail },
    select: { id: true },
  });
  if (taken && taken.id !== user.id) {
    redirect(`${BACK}?erreur=utilisee`);
  }

  const oldEmail = user.email;

  try {
    await prisma.user.update({
      where: { id: user.id },
      // Le lien reçu à la nouvelle adresse prouve qu'elle appartient bien à la personne.
      data: { email: payload.newEmail, emailVerified: new Date() },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect(`${BACK}?erreur=utilisee`);
    }
    console.error("Changement d'adresse email impossible :", error);
    redirect(`${BACK}?erreur=technique`);
  }

  await deleteChangeTokensForUser(user.id);
  await deleteTokensFor("reset", oldEmail);
  await deleteTokensFor("verify", oldEmail);
  await deleteTokensFor("verify", payload.newEmail);

  if (user.role === "ADMIN") {
    await recordAdminAction(
      { id: user.id, email: payload.newEmail },
      {
        action: "admin.email_modifie",
        targetType: "utilisateur",
        targetId: user.id,
      }
    );
  }

  await sendEmailChangedEmail({
    oldEmail,
    name: user.name,
    newEmail: payload.newEmail,
  });

  revalidatePath("/profil");
  revalidatePath("/", "layout");

  redirect("/profil?message=email-modifie");
}
