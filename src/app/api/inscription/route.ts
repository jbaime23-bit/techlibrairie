// src/app/api/inscription/route.ts
// Création d'un compte acheteur ou vendeur.
// Le rôle ADMIN ne peut jamais être obtenu par cette route.

import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { slugWithSuffix } from "@/lib/utils";
import { createAccountToken } from "@/lib/account-tokens";
import { sendVerificationEmail } from "@/lib/account-emails";
import { isEmailConfigured } from "@/lib/email";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

// Marqueur utilisé dans la table des tentatives pour limiter les inscriptions
// (il ne peut pas coïncider avec une vraie adresse email, qui contient toujours un @).
const REGISTRATION_THROTTLE_KEY = "inscription";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Veuillez corriger les champs signalés.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const data = parsed.data;

  // Limitation des inscriptions : protège aussi le quota d'emails du site.
  const ipHash = hashClientIp(request.headers.get("x-forwarded-for"));

  if (await isLoginThrottled(REGISTRATION_THROTTLE_KEY, ipHash)) {
    return NextResponse.json(
      {
        error:
          "Trop d'inscriptions depuis votre connexion. Veuillez réessayer dans 15 minutes.",
      },
      { status: 429 }
    );
  }

  // Chaque tentative d'inscription valide est comptée, qu'elle réussisse ou non.
  await recordLoginFailure(REGISTRATION_THROTTLE_KEY, ipHash);

  const emailTakenResponse = NextResponse.json(
    {
      error: "Un compte existe déjà avec cette adresse email.",
      fieldErrors: { email: ["Cette adresse email est déjà utilisée."] },
    },
    { status: 409 }
  );

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    return emailTakenResponse;
  }

  const passwordHash = await hashPassword(data.password);
  const isSeller = data.accountType === "SELLER";

  try {
    await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone ? data.phone : null,
        role: isSeller ? Role.SELLER : Role.BUYER,
        ...(isSeller && data.displayName
          ? {
              sellerProfile: {
                create: {
                  displayName: data.displayName,
                  slug: slugWithSuffix(data.displayName),
                },
              },
            }
          : {}),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return emailTakenResponse;
    }
    console.error("Erreur lors de l'inscription :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  // Email de vérification : un échec ne doit jamais empêcher l'inscription.
  if (isEmailConfigured()) {
    try {
      const token = await createAccountToken("verify", data.email);
      await sendVerificationEmail({ email: data.email, name: data.name, token });
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email de vérification :", error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
