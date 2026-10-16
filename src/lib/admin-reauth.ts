// src/lib/admin-reauth.ts
// Nouvelle vérification d'identité d'un administrateur avant une action très sensible
// (nommer ou retirer un administrateur, effacer un compte) : mot de passe + code de double authentification.
// Les échecs comptent dans la limitation des tentatives de connexion.

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  clearLoginFailures,
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { verifySecondFactor } from "@/lib/two-factor";

export type ReauthFailure = "limite" | "mot-de-passe" | "code";

export async function verifyAdminReauth(
  admin: { id: string; email: string },
  password: string,
  code: string
): Promise<{ ok: true } | { ok: false; reason: ReauthFailure }> {
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));

  if (await isLoginThrottled(admin.email, ipHash)) {
    return { ok: false, reason: "limite" };
  }

  const account = await prisma.user.findUnique({
    where: { id: admin.id },
    select: {
      id: true,
      passwordHash: true,
      totpEnabledAt: true,
      totpSecretEnc: true,
      totpLastStep: true,
      totpRecoveryHashes: true,
    },
  });

  if (
    !account ||
    !account.passwordHash ||
    !password ||
    !(await bcrypt.compare(password, account.passwordHash))
  ) {
    await recordLoginFailure(admin.email, ipHash);
    return { ok: false, reason: "mot-de-passe" };
  }

  if (account.totpEnabledAt && account.totpSecretEnc) {
    const second = await verifySecondFactor(account, code);
    if (!second.ok) {
      await recordLoginFailure(admin.email, ipHash);
      return { ok: false, reason: "code" };
    }
  }

  await clearLoginFailures(admin.email);
  return { ok: true };
}
