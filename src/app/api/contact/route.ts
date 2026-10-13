// src/app/api/contact/route.ts
// Formulaire de contact du pied de page (public, limité contre le spam).

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdminsNewContact } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const MAX_MESSAGES_PER_HOUR = 5;
// Au-delà de ce nombre de messages par heure sur tout le site, les messages sont
// enregistrés mais n'envoient plus d'alerte email (protège le quota d'envoi).
const MAX_ALERT_EMAILS_PER_HOUR = 20;

const contactSchema = z.object({
  name: z
    .string({ required_error: "Votre nom est obligatoire." })
    .trim()
    .min(2, "Votre nom doit contenir au moins 2 caractères.")
    .max(80, "Votre nom est trop long."),
  email: z
    .string({ required_error: "Votre email est obligatoire." })
    .trim()
    .toLowerCase()
    .email("Adresse email invalide.")
    .max(254),
  phone: z
    .string()
    .trim()
    .max(30, "Numéro de téléphone trop long.")
    .regex(/^[+0-9 ()-]*$/, "Numéro de téléphone invalide.")
    .optional(),
  subject: z
    .string({ required_error: "Le sujet est obligatoire." })
    .trim()
    .min(3, "Le sujet doit contenir au moins 3 caractères.")
    .max(150, "Le sujet est trop long."),
  message: z
    .string({ required_error: "Le message est obligatoire." })
    .trim()
    .min(10, "Le message doit contenir au moins 10 caractères.")
    .max(3000, "Le message est trop long (3000 caractères maximum)."),
  // Champ piège : invisible pour les humains, rempli par les robots.
  website: z.string().optional(),
});

function hashIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "inconnue";
  return createHash("sha256")
    .update(`${ip}:${process.env.NEXTAUTH_SECRET ?? ""}`)
    .digest("hex");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
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

  // Robot détecté : on répond comme si tout allait bien, sans rien enregistrer.
  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const ipHash = hashIp(request);

  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentCount = await prisma.contactMessage.count({
      where: { ipHash, createdAt: { gt: hourAgo } },
    });

    if (recentCount >= MAX_MESSAGES_PER_HOUR) {
      return NextResponse.json(
        { error: "Trop de messages envoyés. Veuillez réessayer dans une heure." },
        { status: 429 }
      );
    }

    const user = await getCurrentUser();

    await prisma.contactMessage.create({
      data: {
        userId: user?.id ?? null,
        name: data.name,
        email: data.email,
        phone: data.phone ? data.phone : null,
        subject: data.subject,
        message: data.message,
        ipHash,
      },
    });

    const totalLastHour = await prisma.contactMessage.count({
      where: { createdAt: { gt: hourAgo } },
    });

    if (totalLastHour <= MAX_ALERT_EMAILS_PER_HOUR) {
      await notifyAdminsNewContact({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      });
    }
  } catch (error) {
    console.error("Erreur d'enregistrement du message de contact :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
      }
