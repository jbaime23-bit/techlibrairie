// src/lib/login-throttle.ts
// Limitation des tentatives de connexion (et de changement de mot de passe).
// Règle : refus si, sur les 15 dernières minutes, il y a
//   - 5 échecs pour le même email depuis la même connexion internet, ou
//   - 20 échecs depuis la même connexion internet, ou
//   - 30 échecs pour le même email (toutes sources confondues).
// Choisir un seuil par couple email + connexion évite qu'un tiers puisse bloquer
// le compte de quelqu'un d'autre depuis ailleurs.
// Aucune de ces fonctions ne lève d'exception : en cas de panne de base,
// la limitation est simplement ignorée (la base étant de toute façon requise pour se connecter).

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const THROTTLED_ERROR = "TROP_DE_TENTATIVES";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL_AND_IP = 5;
const MAX_FAILURES_PER_IP = 20;
const MAX_FAILURES_PER_EMAIL = 30;
// Quand l'adresse IP est inconnue, seul le seuil par email s'applique (plus strict).
const MAX_FAILURES_PER_EMAIL_WITHOUT_IP = 10;

/** Empreinte de l'adresse IP du client (null si elle est inconnue). */
export function hashClientIp(forwardedFor: string | null | undefined): string | null {
  if (!forwardedFor) return null;

  const ip = forwardedFor.split(",")[0].trim();
  if (!ip) return null;

  return createHash("sha256")
    .update(`${ip}:${process.env.NEXTAUTH_SECRET ?? ""}`)
    .digest("hex");
}

/** Vrai si trop d'échecs récents : la tentative doit être refusée. */
export async function isLoginThrottled(
  email: string,
  ipHash: string | null
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - WINDOW_MS);

    const [byEmail, byEmailAndIp, byIp] = await Promise.all([
      prisma.loginAttempt.count({ where: { email, createdAt: { gt: since } } }),
      ipHash
        ? prisma.loginAttempt.count({
            where: { email, ipHash, createdAt: { gt: since } },
          })
        : Promise.resolve(0),
      ipHash
        ? prisma.loginAttempt.count({ where: { ipHash, createdAt: { gt: since } } })
        : Promise.resolve(0),
    ]);

    const emailLimit = ipHash
      ? MAX_FAILURES_PER_EMAIL
      : MAX_FAILURES_PER_EMAIL_WITHOUT_IP;

    return (
      byEmail >= emailLimit ||
      byEmailAndIp >= MAX_FAILURES_PER_EMAIL_AND_IP ||
      byIp >= MAX_FAILURES_PER_IP
    );
  } catch (error) {
    console.error("Limitation de connexion : lecture impossible :", error);
    return false;
  }
}

/** Enregistre un échec de connexion. */
export async function recordLoginFailure(
  email: string,
  ipHash: string | null
): Promise<void> {
  try {
    await prisma.loginAttempt.create({ data: { email, ipHash } });

    // Nettoyage occasionnel des échecs de plus d'un jour.
    if (Math.random() < 0.02) {
      await prisma.loginAttempt.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
    }
  } catch (error) {
    console.error("Limitation de connexion : enregistrement impossible :", error);
  }
}

/** Efface les échecs d'un email (après une connexion réussie ou une réinitialisation par email). */
export async function clearLoginFailures(email: string): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({ where: { email } });
  } catch (error) {
    console.error("Limitation de connexion : effacement impossible :", error);
  }
      }
