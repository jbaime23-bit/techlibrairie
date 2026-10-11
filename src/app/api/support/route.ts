// src/app/api/support/route.ts
// Création d'une conversation de support (payante, tarif figé à la création).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  SUPPORT_CATEGORY_VALUES,
  generateThreadNumber,
  getSupportFeeXof,
} from "@/lib/support";

export const dynamic = "force-dynamic";

const MAX_UNPAID_THREADS = 5;
const MAX_THREADS_PER_DAY = 10;

const createSchema = z.object({
  subject: z
    .string({ required_error: "Le sujet est obligatoire." })
    .trim()
    .min(5, "Le sujet doit contenir au moins 5 caractères.")
    .max(150, "Le sujet est trop long (150 caractères maximum)."),
  category: z.enum(SUPPORT_CATEGORY_VALUES, {
    errorMap: () => ({ message: "Choisissez une catégorie." }),
  }),
  message: z
    .string({ required_error: "Le message est obligatoire." })
    .trim()
    .min(10, "Le message doit contenir au moins 10 caractères.")
    .max(3000, "Le message est trop long (3000 caractères maximum)."),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Veuillez vous connecter pour contacter le support." },
      { status: 401 }
    );
  }

  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Les administrateurs répondent aux conversations depuis l'espace admin." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
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

  try {
    const [unpaidCount, dayCount] = await Promise.all([
      prisma.supportThread.count({
        where: { userId: user.id, status: "AWAITING_PAYMENT" },
      }),
      prisma.supportThread.count({
        where: {
          userId: user.id,
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    if (unpaidCount >= MAX_UNPAID_THREADS) {
      return NextResponse.json(
        {
          error:
            "Vous avez déjà plusieurs conversations en attente de paiement. Payez-les ou annulez-les avant d'en ouvrir une nouvelle.",
        },
        { status: 429 }
      );
    }

    if (dayCount >= MAX_THREADS_PER_DAY) {
      return NextResponse.json(
        { error: "Limite de conversations atteinte pour aujourd'hui. Réessayez demain." },
        { status: 429 }
      );
    }

    const fee = await getSupportFeeXof();
    const isFree = fee === 0;
    const now = new Date();

    const thread = await prisma.supportThread.create({
      data: {
        number: generateThreadNumber(),
        userId: user.id,
        subject: data.subject,
        category: data.category,
        status: isFree ? "OPEN" : "AWAITING_PAYMENT",
        feeAmountXof: fee,
        paidAt: isFree ? now : null,
        lastMessageAt: now,
        messages: {
          create: { senderId: user.id, isStaff: false, body: data.message },
        },
      },
      select: { id: true },
    });

    return NextResponse.json(
      { id: thread.id, requiresPayment: !isFree },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur lors de la création de la conversation de support :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }
  }
