// src/app/api/initialisation/route.ts
// Initialisation unique de la plateforme, protégée par SETUP_SECRET.
// Verrouillée définitivement dès qu'un administrateur existe.

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  SetupAlreadyDoneError,
  hasAdmin,
  runInitialisation,
} from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

const optionalText = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional()
  );

const setupSchema = z.object({
  secret: z
    .string({ required_error: "Le code d'initialisation est obligatoire." })
    .min(1, "Le code d'initialisation est obligatoire.")
    .max(200),
  adminName: z
    .string({ required_error: "Le nom est obligatoire." })
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(80, "Le nom est trop long."),
  adminEmail: z
    .string({ required_error: "L'email est obligatoire." })
    .trim()
    .toLowerCase()
    .email("Adresse email invalide.")
    .max(254),
  adminPassword: z
    .string({ required_error: "Le mot de passe est obligatoire." })
    .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
    .max(100, "Le mot de passe est trop long."),
  contactEmail: optionalText(
    z.string().trim().toLowerCase().email("Adresse email de contact invalide.").max(254)
  ),
  whatsappNumber: optionalText(z.string().trim().max(30)),
});

function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const expectedSecret = process.env.SETUP_SECRET;

  if (!expectedSecret || expectedSecret.length < 16) {
    return NextResponse.json({ error: "Fonction désactivée." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = setupSchema.safeParse(body);
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

  if (!secretsMatch(data.secret, expectedSecret)) {
    await sleep(1000);
    return NextResponse.json(
      {
        error: "Code d'initialisation incorrect.",
        fieldErrors: { secret: ["Code d'initialisation incorrect."] },
      },
      { status: 403 }
    );
  }

  let whatsappNumber: string | undefined;
  if (data.whatsappNumber) {
    const digits = data.whatsappNumber.replace(/\D/g, "");
    if (!/^\d{8,15}$/.test(digits)) {
      return NextResponse.json(
        {
          error: "Veuillez corriger les champs signalés.",
          fieldErrors: {
            whatsappNumber: [
              "Numéro WhatsApp invalide : utilisez le format international (ex. 22670000000).",
            ],
          },
        },
        { status: 422 }
      );
    }
    whatsappNumber = digits;
  }

  try {
    if (await hasAdmin()) {
      return NextResponse.json(
        { error: "L'initialisation a déjà été effectuée." },
        { status: 409 }
      );
    }

    await runInitialisation({
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      adminPassword: data.adminPassword,
      contactEmail: data.contactEmail,
      whatsappNumber,
    });
  } catch (error) {
    if (error instanceof SetupAlreadyDoneError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Erreur d'initialisation :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue pendant l'initialisation. Consultez les journaux Vercel." },
      { status: 500 }
    );
  }

  revalidateTag("contact-info");
  revalidateTag("ads");

  return NextResponse.json({ ok: true }, { status: 201 });
    }
