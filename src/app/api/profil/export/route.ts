// src/app/api/profil/export/route.ts
// Téléchargement des données personnelles de l'utilisateur connecté.
// Le mot de passe est exigé à chaque export ; les exports sont limités en nombre.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildPersonalDataExport } from "@/lib/personal-data";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);

  const user = await getCurrentUser();
  if (!user) {
    return redirectTo(`/connexion?callbackUrl=${encodeURIComponent("/profil/donnees")}`);
  }

  let password = "";
  try {
    const form = await request.formData();
    const raw = form.get("password");
    password = typeof raw === "string" ? raw.slice(0, 200) : "";
  } catch {
    return redirectTo("/profil/donnees?erreur=requete");
  }

  const ipHash = hashClientIp(request.headers.get("x-forwarded-for"));
  const exportKey = `export:${user.id}`;

  if (
    (await isLoginThrottled(user.email, ipHash)) ||
    (await isLoginThrottled(exportKey, ipHash))
  ) {
    return redirectTo("/profil/donnees?erreur=limite");
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
    return redirectTo("/profil/donnees?erreur=mot-de-passe");
  }

  // Chaque export est compté pour limiter la fréquence des téléchargements.
  await recordLoginFailure(exportKey, ipHash);

  let data: Record<string, unknown> | null;
  try {
    data = await buildPersonalDataExport(user.id);
  } catch (error) {
    console.error("Export des données personnelles impossible :", error);
    return redirectTo("/profil/donnees?erreur=technique");
  }

  if (!data) {
    return redirectTo("/profil/donnees?erreur=introuvable");
  }

  const date = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="techlibrairie-mes-donnees-${date}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
