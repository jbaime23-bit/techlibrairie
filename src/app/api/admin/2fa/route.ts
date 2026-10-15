// src/app/api/admin/2fa/route.ts
// Gestion de la double authentification d'un administrateur :
// démarrer l'activation, la confirmer, la désactiver, régénérer les codes de secours.

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminForSetupOrNull } from "@/lib/admin";
import {
  beginTwoFactorSetup,
  completeTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  verifySecondFactor,
} from "@/lib/two-factor";
import {
  clearLoginFailures,
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("confirm"),
    code: z.string().trim().min(6).max(12),
  }),
  z.object({
    action: z.literal("disable"),
    password: z.string().min(1).max(200),
    code: z.string().trim().min(6).max(20),
  }),
  z.object({
    action: z.literal("regenerate"),
    password: z.string().min(1).max(200),
    code: z.string().trim().min(6).max(20),
  }),
]);

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const admin = await getAdminForSetupOrNull();
  if (!admin) {
    return fail("Accès refusé : réservé aux administrateurs.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Requête invalide.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("Veuillez remplir tous les champs demandés.", 422);
  }

  const input = parsed.data;
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));

  const account = await prisma.user.findUnique({
    where: { id: admin.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      totpSecretEnc: true,
      totpLastStep: true,
      totpEnabledAt: true,
      totpRecoveryHashes: true,
    },
  });

  if (!account) {
    return fail("Compte introuvable.", 404);
  }

  const isEnabled = Boolean(account.totpEnabledAt && account.totpSecretEnc);

  if (input.action === "start") {
    if (isEnabled) {
      return fail("La double authentification est déjà activée.", 409);
    }

    try {
      const setup = await beginTwoFactorSetup({ id: account.id, email: account.email });
      return NextResponse.json({ secret: setup.secret, otpauthUri: setup.otpauthUri });
    } catch (error) {
      console.error("Double authentification : démarrage impossible :", error);
      return fail("Impossible de démarrer l'activation. Vérifiez NEXTAUTH_SECRET.", 500);
    }
  }

  // Les actions suivantes manipulent des codes : elles sont soumises à la limitation des tentatives.
  if (await isLoginThrottled(account.email, ipHash)) {
    return fail("Trop de tentatives échouées. Patientez 15 minutes avant de réessayer.", 429);
  }

  if (input.action === "confirm") {
    if (isEnabled) {
      return fail("La double authentification est déjà activée.", 409);
    }

    const result = await completeTwoFactorSetup(account.id, input.code);

    if (!result.ok) {
      await recordLoginFailure(account.email, ipHash);
      return fail(
        "Code incorrect. Vérifiez l'heure de votre téléphone et saisissez le code actuel affiché par l'application.",
        422
      );
    }

    await clearLoginFailures(account.email);
    await recordAudit({
      adminId: account.id,
      adminEmail: account.email,
      action: "admin.2fa_activee",
      targetType: "utilisateur",
      targetId: account.id,
      ipHash,
    });

    return NextResponse.json({ recoveryCodes: result.recoveryCodes });
  }

  // disable et regenerate : mot de passe ET code actuel exigés.
  if (!isEnabled) {
    return fail("La double authentification n'est pas activée.", 409);
  }

  if (!account.passwordHash || !(await bcrypt.compare(input.password, account.passwordHash))) {
    await recordLoginFailure(account.email, ipHash);
    return fail("Mot de passe incorrect.", 422);
  }

  const second = await verifySecondFactor(account, input.code);
  if (!second.ok) {
    await recordLoginFailure(account.email, ipHash);
    return fail("Code incorrect.", 422);
  }

  await clearLoginFailures(account.email);

  if (input.action === "disable") {
    await disableTwoFactor(account.id);
    await recordAudit({
      adminId: account.id,
      adminEmail: account.email,
      action: "admin.2fa_desactivee",
      targetType: "utilisateur",
      targetId: account.id,
      ipHash,
    });

    return NextResponse.json({ ok: true });
  }

  const recoveryCodes = await regenerateRecoveryCodes(account.id);
  await recordAudit({
    adminId: account.id,
    adminEmail: account.email,
    action: "admin.2fa_codes_regeneres",
    targetType: "utilisateur",
    targetId: account.id,
    ipHash,
  });

  return NextResponse.json({ recoveryCodes });
}
