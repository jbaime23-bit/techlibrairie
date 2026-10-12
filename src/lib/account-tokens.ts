// src/lib/account-tokens.ts
// Jetons à usage unique (réinitialisation du mot de passe, vérification de l'email).
// Seule l'empreinte (SHA-256) du jeton est stockée en base, jamais le jeton lui-même.
// Table utilisée : VerificationToken (identifier = "reset:email" ou "verify:email").

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type TokenPurpose = "reset" | "verify";

const TTL_MS: Record<TokenPurpose, number> = {
  reset: 60 * 60 * 1000, // 1 heure
  verify: 24 * 60 * 60 * 1000, // 24 heures
};

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function identifierFor(purpose: TokenPurpose, email: string): string {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

/** Crée un jeton et renvoie sa valeur brute (à envoyer par email, jamais à stocker). */
export async function createAccountToken(
  purpose: TokenPurpose,
  email: string
): Promise<string> {
  // Nettoyage opportuniste des jetons expirés.
  await prisma.verificationToken.deleteMany({
    where: { expires: { lt: new Date() } },
  });

  const rawToken = randomBytes(32).toString("hex");

  await prisma.verificationToken.create({
    data: {
      identifier: identifierFor(purpose, email),
      token: hashToken(rawToken),
      expires: new Date(Date.now() + TTL_MS[purpose]),
    },
  });

  return rawToken;
}

/**
 * Nombre de jetons créés pour cette adresse pendant les dernières minutes.
 * (La date de création est déduite de la date d'expiration.)
 */
export async function countRecentTokens(
  purpose: TokenPurpose,
  email: string,
  windowMinutes: number
): Promise<number> {
  const threshold = new Date(Date.now() + TTL_MS[purpose] - windowMinutes * 60 * 1000);

  return prisma.verificationToken.count({
    where: {
      identifier: identifierFor(purpose, email),
      expires: { gt: threshold },
    },
  });
}

/** Nombre total de jetons encore valides pour un usage (garde-fou global). */
export async function countOutstandingTokens(purpose: TokenPurpose): Promise<number> {
  return prisma.verificationToken.count({
    where: {
      identifier: { startsWith: `${purpose}:` },
      expires: { gt: new Date() },
    },
  });
}

/** Renvoie l'adresse associée à un jeton valide, ou null s'il est invalide ou expiré. */
export async function findValidToken(
  purpose: TokenPurpose,
  rawToken: string
): Promise<{ email: string } | null> {
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return null;

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record || record.expires <= new Date()) return null;

  const prefix = `${purpose}:`;
  if (!record.identifier.startsWith(prefix)) return null;

  return { email: record.identifier.slice(prefix.length) };
}

/** Supprime tous les jetons d'un usage pour une adresse (après utilisation). */
export async function deleteTokensFor(
  purpose: TokenPurpose,
  email: string
): Promise<void> {
  await prisma.verificationToken.deleteMany({
    where: { identifier: identifierFor(purpose, email) },
  });
    }
