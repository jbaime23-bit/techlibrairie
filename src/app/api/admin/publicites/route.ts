// src/app/api/admin/publicites/route.ts
// Création d'une publicité (bannière locale ou emplacement Adsterra) par un administrateur.

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { deletePublicCover, uploadPublicCover } from "@/lib/storage";
import { recordAdminAction } from "@/lib/audit";
import {
  AD_KIND_VALUES,
  AD_PLACEMENT_VALUES,
  isActivePlacement,
} from "@/lib/ad-options";

export const dynamic = "force-dynamic";

type FieldErrors = Record<string, string[] | undefined>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const adSchema = z
  .object({
    name: z
      .string({ required_error: "Le nom est obligatoire." })
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(100, "Le nom est trop long."),
    placement: z.enum(AD_PLACEMENT_VALUES, {
      errorMap: () => ({ message: "Choisissez un emplacement." }),
    }),
    kind: z.enum(AD_KIND_VALUES, {
      errorMap: () => ({ message: "Choisissez un type de publicité." }),
    }),
    priority: z.coerce
      .number({ invalid_type_error: "Priorité invalide." })
      .int("La priorité doit être un entier.")
      .min(-100, "Priorité minimale : -100.")
      .max(100, "Priorité maximale : 100.")
      .default(0),
    advertiserName: z.string().trim().max(100, "Nom trop long.").optional(),
    advertiserEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Adresse email invalide.")
      .max(254)
      .optional(),
    advertiserPhone: z
      .string()
      .trim()
      .max(30, "Numéro trop long.")
      .regex(/^[+0-9 ()-]*$/, "Numéro de téléphone invalide.")
      .optional(),
    targetUrl: z.string().trim().url("Lien invalide.").max(500, "Lien trop long.").optional(),
    altText: z.string().trim().max(150, "Texte trop long (150 caractères maximum).").optional(),
    priceAmountXof: z.coerce
      .number({ invalid_type_error: "Prix invalide." })
      .int("Le prix doit être un nombre entier de FCFA.")
      .min(0, "Le prix ne peut pas être négatif.")
      .max(100_000_000, "Prix trop élevé.")
      .optional(),
    startsAt: z.string().regex(DATE_REGEX, "Date invalide.").optional(),
    endsAt: z.string().regex(DATE_REGEX, "Date invalide.").optional(),
  })
  .superRefine((data, ctx) => {
    if (!isActivePlacement(data.placement)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["placement"],
        message: "Cet emplacement n'est pas encore affiché sur le site.",
      });
    }

    if (data.targetUrl) {
      const protocol = new URL(data.targetUrl).protocol;
      if (protocol !== "https:" && protocol !== "http:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetUrl"],
          message: "Le lien doit commencer par https:// ou http://.",
        });
      }
    }

    if (data.kind === "LOCAL_BANNER") {
      if (!data.targetUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetUrl"],
          message: "Le lien de destination est obligatoire.",
        });
      }
      if (!data.advertiserName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["advertiserName"],
          message: "Le nom de l'entreprise annonceuse est obligatoire.",
        });
      }
    }

    if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "La date de fin doit être postérieure à la date de début.",
      });
    }
  });

function readField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function validationError(fieldErrors: FieldErrors, status: number = 422) {
  return NextResponse.json(
    { error: "Veuillez corriger les champs signalés.", fieldErrors },
    { status }
  );
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json(
      { error: "Accès refusé : réservé aux administrateurs." },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = adSchema.safeParse({
    name: readField(formData, "name"),
    placement: readField(formData, "placement"),
    kind: readField(formData, "kind"),
    priority: readField(formData, "priority"),
    advertiserName: readField(formData, "advertiserName"),
    advertiserEmail: readField(formData, "advertiserEmail"),
    advertiserPhone: readField(formData, "advertiserPhone"),
    targetUrl: readField(formData, "targetUrl"),
    altText: readField(formData, "altText"),
    priceAmountXof: readField(formData, "priceAmountXof"),
    startsAt: readField(formData, "startsAt"),
    endsAt: readField(formData, "endsAt"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as FieldErrors);
  }

  const data = parsed.data;
  const isLocal = data.kind === "LOCAL_BANNER";

  let imageUrl: string | null = null;

  if (isLocal) {
    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return validationError({ image: ["Sélectionnez l'image de la bannière."] });
    }

    try {
      imageUrl = await uploadPublicCover(image, "publicites");
    } catch (error) {
      return validationError({
        image: [
          error instanceof Error ? error.message : "Impossible d'envoyer l'image.",
        ],
      });
    }
  }

  try {
    const created = await prisma.adSpace.create({
      data: {
        name: data.name,
        placement: data.placement,
        kind: data.kind,
        priority: data.priority,
        isActive: true,
        advertiserName: isLocal ? data.advertiserName ?? null : null,
        advertiserEmail: isLocal ? data.advertiserEmail ?? null : null,
        advertiserPhone: isLocal ? data.advertiserPhone ?? null : null,
        targetUrl: isLocal ? data.targetUrl ?? null : null,
        altText:
          isLocal || data.kind === "ADSTERRA_DIRECT_LINK" ? data.altText ?? null : null,
        imageUrl,
        priceAmountXof: isLocal ? data.priceAmountXof ?? null : null,
        startsAt: isLocal && data.startsAt ? new Date(`${data.startsAt}T00:00:00.000Z`) : null,
        endsAt: isLocal && data.endsAt ? new Date(`${data.endsAt}T23:59:59.999Z`) : null,
      },
      select: { id: true },
    });

    await recordAdminAction(admin, {
      action: "publicite.creee",
      targetType: "publicite",
      targetId: created.id,
      details: {
        nom: data.name,
        type: data.kind,
        emplacement: data.placement,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la création de la publicité :", error);
    if (imageUrl) {
      await deletePublicCover(imageUrl).catch(() => undefined);
    }
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  revalidateTag("ads");
  revalidatePath("/admin/publicites");

  return NextResponse.json({ ok: true }, { status: 201 });
    }
