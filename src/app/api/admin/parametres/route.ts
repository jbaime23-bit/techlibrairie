// src/app/api/admin/parametres/route.ts
// Mise à jour des paramètres globaux de la plateforme (administrateur uniquement).

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function numberField(label: string, min: number, max: number, integer: boolean) {
  let schema = z.coerce.number({ invalid_type_error: `${label} : valeur invalide.` });
  if (integer) {
    schema = schema.int(`${label} : un nombre entier est requis.`);
  }
  return z.preprocess(
    emptyToUndefined,
    schema
      .min(min, `${label} : minimum ${min}.`)
      .max(max, `${label} : maximum ${max}.`)
  );
}

const settingsSchema = z.object({
  commissionPercent: numberField("Commission", 0, 90, false),
  fxMarginPercent: numberField("Marge de conversion", 0, 20, false),
  minPayoutAmountXof: numberField("Versement minimum", 0, 10_000_000, true),
  supportFeeXof: numberField("Tarif du support", 0, 1_000_000, true).refine(
    (value) => (value as number) % 5 === 0,
    "Le tarif doit être un multiple de 5 FCFA (exigence du Mobile Money)."
  ),
  downloadLinkTtlHours: numberField("Durée du lien", 1, 720, true),
  downloadMaxAttempts: numberField("Nombre de téléchargements", 1, 50, true),
  contactEmail: z.preprocess(
    emptyToUndefined,
    z.string().trim().toLowerCase().email("Adresse email invalide.").max(254).optional()
  ),
  whatsappNumber: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
});

export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json(
      { error: "Accès refusé : réservé aux administrateurs." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
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

  let whatsappNumber: string | null = null;
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

  const values = {
    defaultCommissionRateBps: Math.round((data.commissionPercent as number) * 100),
    fxMarginBps: Math.round((data.fxMarginPercent as number) * 100),
    minPayoutAmountXof: data.minPayoutAmountXof as number,
    supportFeeXof: data.supportFeeXof as number,
    downloadLinkTtlHours: data.downloadLinkTtlHours as number,
    downloadMaxAttempts: data.downloadMaxAttempts as number,
    contactEmail: data.contactEmail ?? null,
    whatsappNumber,
  };

  try {
    await prisma.platformSetting.upsert({
      where: { id: "global" },
      update: values,
      create: { id: "global", ...values },
    });
  } catch (error) {
    console.error("Erreur d'enregistrement des paramètres :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  await recordAdminAction(admin, {
    action: "parametres.modifies",
    targetType: "parametres",
    targetId: "global",
    details: {
      commission_defaut_pour_cent: values.defaultCommissionRateBps / 100,
      marge_change_pour_cent: values.fxMarginBps / 100,
      versement_minimum_fcfa: values.minPayoutAmountXof,
      tarif_support_fcfa: values.supportFeeXof,
      duree_lien_heures: values.downloadLinkTtlHours,
      telechargements_max: values.downloadMaxAttempts,
      email_de_contact_defini: values.contactEmail !== null,
      whatsapp_defini: values.whatsappNumber !== null,
    },
  });

  revalidateTag("contact-info");

  return NextResponse.json({ ok: true });
    }
