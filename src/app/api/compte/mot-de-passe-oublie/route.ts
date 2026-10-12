// src/app/api/compte/mot-de-passe-oublie/route.ts
// Demande de réinitialisation du mot de passe.
// La réponse est la même que l'adresse existe ou non.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/account-validation";
import {
  countOutstandingTokens,
  countRecentTokens,
  createAccountToken,
} from "@/lib/account-tokens";
import { sendPasswordResetEmail } from "@/lib/account-emails";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

const MAX_REQUESTS_PER_WINDOW = 2;
const WINDOW_MINUTES = 15;
const MAX_OUTSTANDING_TOKENS = 40;

export async function POST(request: Request) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "La récupération par email est momentanément indisponible. Contactez le support depuis le pied de page.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Veuillez corriger l'adresse email.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { email } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true, email: true, isActive: true, passwordHash: true },
    });

    if (user && user.isActive && user.passwordHash) {
      const [recent, outstanding] = await Promise.all([
        countRecentTokens("reset", email, WINDOW_MINUTES),
        countOutstandingTokens("reset"),
      ]);

      if (recent < MAX_REQUESTS_PER_WINDOW && outstanding < MAX_OUTSTANDING_TOKENS) {
        const token = await createAccountToken("reset", email);
        await sendPasswordResetEmail({ email: user.email, name: user.name, token });
      }
    }
  } catch (error) {
    console.error("Erreur lors de la demande de réinitialisation :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
        }
