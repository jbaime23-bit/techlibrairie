// src/app/api/support/[id]/messages/route.ts
// Envoi d'un message dans une conversation (utilisateur propriétaire ou administrateur).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_MESSAGES_PER_DAY = 30;

const messageSchema = z.object({
  body: z
    .string({ required_error: "Le message est obligatoire." })
    .trim()
    .min(2, "Le message est trop court.")
    .max(3000, "Le message est trop long (3000 caractères maximum)."),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Veuillez vous connecter." },
      { status: 401 }
    );
  }

  if (!/^[a-z0-9]{1,40}$/i.test(params.id)) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Veuillez corriger le message.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const isStaff = user.role === "ADMIN";

  const thread = await prisma.supportThread.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, status: true, assignedToId: true },
  });

  if (!thread || (!isStaff && thread.userId !== user.id)) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  if (thread.status !== "OPEN" && thread.status !== "ANSWERED") {
    return NextResponse.json(
      {
        error:
          thread.status === "AWAITING_PAYMENT"
            ? "Cette conversation est en attente de paiement."
            : "Cette conversation est clôturée.",
      },
      { status: 409 }
    );
  }

  try {
    if (!isStaff) {
      const dayCount = await prisma.message.count({
        where: {
          threadId: thread.id,
          senderId: user.id,
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (dayCount >= MAX_MESSAGES_PER_DAY) {
        return NextResponse.json(
          { error: "Limite de messages atteinte pour aujourd'hui. Réessayez demain." },
          { status: 429 }
        );
      }
    }

    await prisma.$transaction([
      prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: user.id,
          isStaff,
          body: parsed.data.body,
        },
      }),
      prisma.supportThread.update({
        where: { id: thread.id },
        data: {
          status: isStaff ? "ANSWERED" : "OPEN",
          lastMessageAt: new Date(),
          ...(isStaff && !thread.assignedToId ? { assignedToId: user.id } : {}),
        },
      }),
    ]);
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de support :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
    }
