// src/app/vendeur/revenus/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import {
  formatMobileNumber,
  getSellerBalanceXof,
  isPayoutOperator,
  normalizeMobileNumber,
  operatorLabel,
} from "@/lib/payouts";

const BACK = "/vendeur/revenus";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Contexte vendeur actif, ou redirection. */
async function requireActiveSeller() {
  const context = await getSellerContext();

  if (context.status === "unauthenticated") {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(BACK)}`);
  }
  if (context.status !== "ok") {
    redirect(`${BACK}?erreur=compte`);
  }
  return context;
}

/** Enregistre le numéro Orange Money ou Moov Money de versement (mot de passe exigé). */
export async function savePayoutDetailsAction(formData: FormData): Promise<void> {
  const { user, seller } = await requireActiveSeller();

  const operator = readText(formData, "operator", 30);
  const numberRaw = readText(formData, "mobileNumber", 40);
  const password = readText(formData, "password", 200);

  if (!isPayoutOperator(operator)) {
    redirect(`${BACK}?erreur=operateur`);
  }

  const mobileNumber = normalizeMobileNumber(numberRaw);
  if (!mobileNumber) {
    redirect(`${BACK}?erreur=numero`);
  }

  if (!password) {
    redirect(`${BACK}?erreur=mot-de-passe`);
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  const passwordIsValid =
    account?.passwordHash !== null &&
    account?.passwordHash !== undefined &&
    (await bcrypt.compare(password, account.passwordHash));

  if (!passwordIsValid) {
    redirect(`${BACK}?erreur=mot-de-passe`);
  }

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: {
      payoutMobileOperator: operator,
      payoutMobileNumber: mobileNumber,
    },
  });

  revalidatePath(BACK);
  redirect(`${BACK}?message=destination-enregistree`);
}

/** Demande un versement (une seule demande ouverte à la fois, solde verrouillé). */
export async function requestPayoutAction(formData: FormData): Promise<void> {
  const { seller } = await requireActiveSeller();

  const rawAmount = readText(formData, "amount", 12);
  if (!/^\d{1,9}$/.test(rawAmount)) {
    redirect(`${BACK}?erreur=montant`);
  }
  const amount = Number(rawAmount);

  if (!seller.payoutMobileNumber || !seller.payoutMobileOperator) {
    redirect(`${BACK}?erreur=destination`);
  }

  const settings = await prisma.platformSetting.findUnique({
    where: { id: "global" },
    select: { minPayoutAmountXof: true },
  });
  const minimum = settings?.minPayoutAmountXof ?? 5000;

  if (amount < Math.max(minimum, 1)) {
    redirect(`${BACK}?erreur=minimum`);
  }

  const destination = `Destination : ${operatorLabel(seller.payoutMobileOperator)} ${formatMobileNumber(
    seller.payoutMobileNumber
  )}`;

  let outcome: "ok" | "insuffisant" | "en-cours" | "erreur" = "erreur";

  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        // Verrouille la ligne du vendeur : deux demandes simultanées sont traitées l'une après l'autre.
        await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${seller.id} FOR UPDATE`;

        const openCount = await tx.payout.count({
          where: { sellerId: seller.id, status: { in: ["PENDING", "PROCESSING"] } },
        });
        if (openCount > 0) return "en-cours" as const;

        const balance = await getSellerBalanceXof(seller.id, tx);
        if (amount > balance.available) return "insuffisant" as const;

        await tx.payout.create({
          data: {
            sellerId: seller.id,
            amount,
            currency: "XOF",
            status: "PENDING",
            method: seller.payoutMobileOperator,
            note: destination,
          },
        });

        return "ok" as const;
      },
      { timeout: 20000, maxWait: 10000 }
    );
  } catch (error) {
    console.error("Erreur lors de la demande de versement :", error);
    outcome = "erreur";
  }

  revalidatePath(BACK);
  revalidatePath("/admin/versements");

  if (outcome === "ok") {
    redirect(`${BACK}?message=demande-creee`);
  }
  redirect(`${BACK}?erreur=${outcome === "erreur" ? "technique" : outcome}`);
}

/** Annule une demande tant qu'elle est encore en attente. */
export async function cancelPayoutAction(formData: FormData): Promise<void> {
  const { seller } = await requireActiveSeller();

  const payoutId = readText(formData, "payoutId", 40);
  if (!/^[a-z0-9]{1,40}$/i.test(payoutId)) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const payout = await prisma.payout.findFirst({
    where: { id: payoutId, sellerId: seller.id, status: "PENDING" },
    select: { id: true, note: true },
  });

  if (!payout) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const result = await prisma.payout.updateMany({
    where: { id: payout.id, sellerId: seller.id, status: "PENDING" },
    data: {
      status: "FAILED",
      note: `${payout.note ? `${payout.note} | ` : ""}Annulé par le vendeur`,
    },
  });

  revalidatePath(BACK);
  revalidatePath("/admin/versements");

  redirect(
    result.count > 0 ? `${BACK}?message=demande-annulee` : `${BACK}?erreur=introuvable`
  );
}
