// src/app/acheteur/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateDownloadToken } from "@/lib/utils";

// Le lien d'origine compte pour un : 4 liens au maximum par ouvrage et par 24 heures.
const MAX_TOKENS_PER_DAY = 4;

/** Génère un nouveau lien de téléchargement pour un ouvrage acheté (payé). */
export async function regenerateDownloadLinkAction(formData: FormData): Promise<void> {
  const returnTo = formData.get("returnTo") === "dashboard" ? "/acheteur" : "/acheteur/commandes";

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  const rawItemId = formData.get("orderItemId");
  if (typeof rawItemId !== "string" || !/^[a-z0-9]{1,40}$/i.test(rawItemId)) {
    redirect(`${returnTo}?lien=invalide`);
  }

  // L'ouvrage doit appartenir à une commande PAYÉE de cet acheteur.
  const item = await prisma.orderItem.findFirst({
    where: {
      id: rawItemId,
      order: { buyerId: user.id, status: "PAID" },
    },
    select: { id: true },
  });

  if (!item) {
    redirect(`${returnTo}?lien=invalide`);
  }

  const now = new Date();

  // Si le dernier lien est encore utilisable, inutile d'en créer un autre.
  const latest = await prisma.downloadToken.findFirst({
    where: { orderItemId: item.id },
    orderBy: { createdAt: "desc" },
    select: { expiresAt: true, maxDownloads: true, downloadCount: true },
  });

  if (
    latest &&
    latest.expiresAt > now &&
    latest.downloadCount < latest.maxDownloads
  ) {
    redirect(`${returnTo}?lien=valide`);
  }

  const recentCount = await prisma.downloadToken.count({
    where: {
      orderItemId: item.id,
      createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });

  if (recentCount >= MAX_TOKENS_PER_DAY) {
    redirect(`${returnTo}?lien=limite`);
  }

  const settings = await prisma.platformSetting.findUnique({
    where: { id: "global" },
    select: { downloadLinkTtlHours: true, downloadMaxAttempts: true },
  });

  const ttlHours = settings?.downloadLinkTtlHours ?? 72;
  const maxDownloads = settings?.downloadMaxAttempts ?? 5;

  await prisma.downloadToken.create({
    data: {
      orderItemId: item.id,
      token: generateDownloadToken(),
      expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000),
      maxDownloads,
    },
  });

  revalidatePath("/acheteur");
  revalidatePath("/acheteur/commandes");

  redirect(`${returnTo}?lien=ok`);
            }
