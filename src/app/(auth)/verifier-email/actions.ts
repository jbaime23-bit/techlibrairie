// src/app/(auth)/verifier-email/actions.ts
"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { countRecentTokens, createAccountToken } from "@/lib/account-tokens";
import { sendVerificationEmail } from "@/lib/account-emails";
import { isEmailConfigured } from "@/lib/email";

const BACK = "/verifier-email";
const MAX_SENDS_PER_WINDOW = 2;
const WINDOW_MINUTES = 15;

/** Renvoie l'email de vérification à l'utilisateur connecté. */
export async function resendVerificationEmailAction(): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(BACK)}`);
  }

  if (user.emailVerified) {
    redirect(`${BACK}?message=deja`);
  }

  if (!isEmailConfigured()) {
    redirect(`${BACK}?erreur=indisponible`);
  }

  const recent = await countRecentTokens("verify", user.email, WINDOW_MINUTES);
  if (recent >= MAX_SENDS_PER_WINDOW) {
    redirect(`${BACK}?erreur=limite`);
  }

  const token = await createAccountToken("verify", user.email);
  const result = await sendVerificationEmail({
    email: user.email,
    name: user.name,
    token,
  });

  if (!result.ok) {
    redirect(`${BACK}?erreur=envoi`);
  }

  redirect(`${BACK}?message=envoye`);
}
