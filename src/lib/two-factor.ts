// src/lib/two-factor.ts
// Double authentification par code temporaire (TOTP, RFC 6238) pour les administrateurs.
// - La clé secrète est chiffrée en base (AES-256-GCM, clé dérivée de NEXTAUTH_SECRET).
//   Changer NEXTAUTH_SECRET rend les clés illisibles : utilisez alors les codes de secours.
// - Un code ne peut servir qu'une seule fois (suivi du dernier créneau accepté).
// - 8 codes de secours à usage unique, conservés sous forme d'empreintes.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { prisma } from "@/lib/prisma";

export const TWO_FACTOR_REQUIRED_ERROR = "CODE_2FA_REQUIS";
export const TWO_FACTOR_INVALID_ERROR = "CODE_2FA_INVALIDE";

const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = "TechLibrairie";
const RECOVERY_CODE_COUNT = 8;

/** La double authentification est obligatoire pour les administrateurs, sauf si ADMIN_2FA_REQUIRED vaut "false". */
export function isTwoFactorRequired(): boolean {
  return process.env.ADMIN_2FA_REQUIRED !== "false";
}

// ---------------------------------------------------------------------------
// Base32 (alphabet utilisé par les applications d'authentification)
// ---------------------------------------------------------------------------

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) {
      throw new Error("Clé secrète invalide.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// Chiffrement de la clé secrète au repos
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET est manquant.");
  }
  return createHash("sha256").update(`tl-2fa-v1:${secret}`).digest();
}

function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(".");

  if (version !== "v1" || !ivPart || !tagPart || !dataPart) {
    throw new Error("Format de clé chiffrée inattendu.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Calcul et vérification des codes
// ---------------------------------------------------------------------------

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Vérifie un code à 6 chiffres (créneau courant, précédent ou suivant) et renvoie le créneau accepté. */
function verifyTotp(
  secretBase32: string,
  token: string,
  lastStep: number | null
): { ok: true; step: number } | { ok: false } {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false };

  const secret = base32Decode(secretBase32);
  const currentStep = Math.floor(Date.now() / 1000 / STEP_SECONDS);

  for (const offset of [0, -1, 1]) {
    const step = currentStep + offset;
    if (lastStep !== null && step <= lastStep) continue;

    const expected = hotp(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) {
      return { ok: true, step };
    }
  }

  return { ok: false };
}

// ---------------------------------------------------------------------------
// Codes de secours
// ---------------------------------------------------------------------------

const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateRecoveryCode(): string {
  const bytes = randomBytes(10);
  let raw = "";
  for (const byte of bytes) {
    raw += RECOVERY_ALPHABET[byte % 32];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function hashRecoveryCode(input: string): string {
  return createHmac("sha256", getEncryptionKey())
    .update(normalizeRecoveryCode(input))
    .digest("hex");
}

function createRecoverySet(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  return { codes, hashes: codes.map((code) => hashRecoveryCode(code)) };
}

// ---------------------------------------------------------------------------
// Opérations sur les comptes
// ---------------------------------------------------------------------------

export interface TwoFactorUserFields {
  id: string;
  totpSecretEnc: string | null;
  totpLastStep: number | null;
  totpRecoveryHashes: string[];
}

/**
 * Vérifie le deuxième facteur d'un compte : code à 6 chiffres ou code de secours.
 * Un code de secours est consommé à l'usage.
 */
export async function verifySecondFactor(
  user: TwoFactorUserFields,
  input: string
): Promise<{ ok: boolean; usedRecoveryCode: boolean }> {
  const value = input.trim();
  if (!value || !user.totpSecretEnc) {
    return { ok: false, usedRecoveryCode: false };
  }

  if (/^\d{3}\s?\d{3}$/.test(value)) {
    let secret: string;
    try {
      secret = decryptSecret(user.totpSecretEnc);
    } catch (error) {
      console.error("Double authentification : clé illisible :", error);
      return { ok: false, usedRecoveryCode: false };
    }

    const result = verifyTotp(secret, value, user.totpLastStep);
    if (!result.ok) return { ok: false, usedRecoveryCode: false };

    // Enregistrement atomique du créneau : un même code ne passe qu'une fois.
    const claimed = await prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: result.step } }],
      },
      data: { totpLastStep: result.step },
    });

    return { ok: claimed.count > 0, usedRecoveryCode: false };
  }

  // Sinon : code de secours.
  const normalized = normalizeRecoveryCode(value);
  if (normalized.length !== 10) {
    return { ok: false, usedRecoveryCode: false };
  }

  const hash = hashRecoveryCode(value);
  if (!user.totpRecoveryHashes.includes(hash)) {
    return { ok: false, usedRecoveryCode: false };
  }

  const remaining = user.totpRecoveryHashes.filter((item) => item !== hash);
  const consumed = await prisma.user.updateMany({
    where: { id: user.id, totpRecoveryHashes: { has: hash } },
    data: { totpRecoveryHashes: remaining },
  });

  return { ok: consumed.count > 0, usedRecoveryCode: consumed.count > 0 };
}

/** Démarre l'activation : génère une clé en attente de confirmation. */
export async function beginTwoFactorSetup(user: {
  id: string;
  email: string;
}): Promise<{ secret: string; otpauthUri: string }> {
  const secret = base32Encode(randomBytes(20));

  await prisma.user.update({
    where: { id: user.id },
    data: { totpPendingEnc: encryptSecret(secret) },
  });

  const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(user.email)}`;
  const otpauthUri =
    `otpauth://totp/${label}?secret=${secret}` +
    `&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

  return { secret, otpauthUri };
}

/** Confirme l'activation avec un premier code valide et génère les codes de secours. */
export async function completeTwoFactorSetup(
  userId: string,
  code: string
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpPendingEnc: true, totpEnabledAt: true },
  });

  if (!user || !user.totpPendingEnc || user.totpEnabledAt) {
    return { ok: false };
  }

  let secret: string;
  try {
    secret = decryptSecret(user.totpPendingEnc);
  } catch (error) {
    console.error("Double authentification : clé en attente illisible :", error);
    return { ok: false };
  }

  const result = verifyTotp(secret, code, null);
  if (!result.ok) return { ok: false };

  const { codes, hashes } = createRecoverySet();

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecretEnc: encryptSecret(secret),
      totpPendingEnc: null,
      totpEnabledAt: new Date(),
      totpLastStep: result.step,
      totpRecoveryHashes: hashes,
    },
  });

  return { ok: true, recoveryCodes: codes };
}

/** Désactive la double authentification d'un compte (efface clé et codes de secours). */
export async function disableTwoFactor(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecretEnc: null,
      totpPendingEnc: null,
      totpEnabledAt: null,
      totpLastStep: null,
      totpRecoveryHashes: [],
    },
  });
}

/** Remplace les codes de secours par un nouveau jeu de 8 codes. */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const { codes, hashes } = createRecoverySet();

  await prisma.user.update({
    where: { id: userId },
    data: { totpRecoveryHashes: hashes },
  });

  return codes;
}
