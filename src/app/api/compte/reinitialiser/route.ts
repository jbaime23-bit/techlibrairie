// src/app/api/compte/reinitialiser/route.ts
// Enregistre le nouveau mot de passe à partir d'un lien de réinitialisation valide.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/account-validation";
import { deleteTokensFor, findValidToken } from "@/lib/account-tokens";
import { clearLoginFailures } from "@/lib/login-throttle";

export const dynamic = "force-dynamic";

const INVALID_LINK = "Ce lien est invalide ou a expiré. Faites une nouvelle demande.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    if (fieldErrors.token) {
      return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Veuillez corriger le mot de passe.", fieldErrors },
      { status: 422 }
    );
  }

  const { token, password } = parsed.data;

  try {
    const valid = await findValidToken("reset", token);
    if (!valid) {
      return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: valid.email },
      select: { id: true, isActive: true, emailVerified: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Toutes les sessions ouvertes avant ce moment sont désormais refusées.
        passwordChangedAt: new Date(),
        // Le lien reçu par email prouve que l'adresse appartient bien à la personne.
        ...(user.emailVerified ? {} : { emailVerified: new Date() }),
      },
    });

    await deleteTokensFor("reset", valid.email);
    await clearLoginFailures(valid.email);
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du mot de passe :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
