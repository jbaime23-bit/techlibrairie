// src/app/api/diagnostic/connexion/route.ts
// OUTIL TEMPORAIRE (à supprimer ensuite) : aide à comprendre pourquoi une connexion échoue.
// Protégé par la variable DIAGNOSTIC_KEY ; sans elle, la page répond « introuvable ».
// N'affiche jamais de mot de passe, d'adresse email, de clé ni de jeton : seulement des compteurs et des états.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashClientIp } from "@/lib/login-throttle";

export const dynamic = "force-dynamic";

function sameKey(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return "valeur invalide";
  }
}

export async function GET(request: Request) {
  const expected = process.env.DIAGNOSTIC_KEY?.trim() ?? "";
  const url = new URL(request.url);
  const given = url.searchParams.get("cle") ?? "";

  if (expected.length < 8 || !sameKey(expected, given)) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const unlock = url.searchParams.get("debloquer") === "oui";
  const ipHash = hashClientIp(request.headers.get("x-forwarded-for"));
  const since = new Date(Date.now() - 15 * 60 * 1000);

  const report: Record<string, unknown> = {
    nom_de_domaine_de_cette_requete: url.host,
    variables: {
      NEXTAUTH_SECRET_presente: Boolean(process.env.NEXTAUTH_SECRET),
      NEXTAUTH_SECRET_longueur: process.env.NEXTAUTH_SECRET?.length ?? 0,
      AUTH_SECRET_presente: Boolean(process.env.AUTH_SECRET),
      NEXTAUTH_URL_domaine: hostOf(process.env.NEXTAUTH_URL),
      NEXT_PUBLIC_APP_URL_domaine: hostOf(process.env.NEXT_PUBLIC_APP_URL),
      ADMIN_2FA_REQUIRED: process.env.ADMIN_2FA_REQUIRED ?? "absente",
      RESET_2FA_EMAIL_presente: Boolean(process.env.RESET_2FA_EMAIL),
      RESEND_API_KEY_presente: Boolean(process.env.RESEND_API_KEY),
      environnement: process.env.VERCEL_ENV ?? "inconnu",
    },
  };

  try {
    const [roles, inactive, noHash, twoFactor, recentForIp, recentAll] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], where: { isActive: false }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], where: { passwordHash: null }, _count: { _all: true } }),
      prisma.user.count({ where: { role: "ADMIN", totpEnabledAt: { not: null } } }),
      ipHash
        ? prisma.loginAttempt.count({ where: { ipHash, createdAt: { gte: since } } })
        : Promise.resolve(0),
      prisma.loginAttempt.count({ where: { createdAt: { gte: since } } }),
    ]);

    const byRole = (rows: { role: string; _count: { _all: number } }[]) =>
      Object.fromEntries(rows.map((row) => [row.role, row._count._all]));

    report.base_de_donnees = {
      reponse: "ok",
      comptes_par_role: byRole(roles),
      comptes_desactives_par_role: byRole(inactive),
      comptes_sans_mot_de_passe_par_role: byRole(noHash),
      administrateurs_avec_double_authentification: twoFactor,
    };

    report.limitation_des_tentatives = {
      echecs_depuis_15_minutes_pour_votre_connexion: recentForIp,
      echecs_depuis_15_minutes_tous_utilisateurs: recentAll,
    };

    if (unlock) {
      const removed = await prisma.loginAttempt.deleteMany({});
      report.deblocage = `${removed.count} tentative(s) échouée(s) effacée(s). Réessayez de vous connecter.`;
    }
  } catch (error) {
    report.base_de_donnees = {
      reponse: "ERREUR",
      detail: error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 200) : "inconnue",
    };
  }

  return new NextResponse(JSON.stringify(report, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
      }
