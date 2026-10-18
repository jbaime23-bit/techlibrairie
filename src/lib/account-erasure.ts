// src/lib/account-erasure.ts
// Effacement (anonymisation) d'un compte utilisateur.
// Le compte n'est pas supprimé de la base : les commandes passées sont conservées
// (obligations comptables) mais ne sont plus reliées à des données personnelles.

import { randomBytes } from "crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSellerBalanceXof } from "@/lib/payouts";
import { recomputeProductRating } from "@/lib/reviews";
import { sendEmail } from "@/lib/email";

export const ERASED_EMAIL_DOMAIN = "efface.invalid";

export type ErasureFailure =
  | "introuvable"
  | "admin"
  | "deja-efface"
  | "solde-vendeur"
  | "versement-en-cours";

export type ErasureResult =
  | { ok: true; role: Role; ordersKept: number }
  | { ok: false; reason: ErasureFailure };

interface ErasureOutcome {
  role: Role;
  ordersKept: number;
  previousEmail: string;
  previousName: string | null;
}

/**
 * Anonymise un compte. Refuse si le compte est administrateur, ou si un vendeur
 * a encore de l'argent à recevoir ou un versement en cours (à régler d'abord).
 */
export async function eraseUserAccount(userId: string): Promise<ErasureResult> {
  const outcome = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          sellerProfile: { select: { id: true } },
        },
      });

      if (!user) return { ok: false as const, reason: "introuvable" as const };
      if (user.role === "ADMIN") return { ok: false as const, reason: "admin" as const };
      if (user.email.endsWith(`@${ERASED_EMAIL_DOMAIN}`)) {
        return { ok: false as const, reason: "deja-efface" as const };
      }

      const sellerId = user.sellerProfile?.id ?? null;

      if (sellerId) {
        const balance = await getSellerBalanceXof(sellerId, tx);

        if (balance.open > 0) {
          return { ok: false as const, reason: "versement-en-cours" as const };
        }

        const owedXof = balance.earned - balance.paid - balance.open;
        const otherCurrencies = await tx.orderItem.aggregate({
          where: {
            sellerId,
            currency: { not: "XOF" },
            order: { status: "PAID" },
          },
          _sum: { sellerAmount: true },
        });

        if (owedXof > 0 || (otherCurrencies._sum.sellerAmount ?? 0) > 0) {
          return { ok: false as const, reason: "solde-vendeur" as const };
        }
      }

      const now = new Date();
      const lowerEmail = user.email.toLowerCase();

      // Commandes en attente : annulées.
      const pendingOrders = await tx.order.findMany({
        where: { buyerId: user.id, status: "PENDING" },
        select: { id: true },
      });

      if (pendingOrders.length > 0) {
        const ids = pendingOrders.map((order) => order.id);
        await tx.payment.updateMany({
          where: { orderId: { in: ids }, status: "PENDING" },
          data: { status: "CANCELED" },
        });
        await tx.order.updateMany({
          where: { id: { in: ids } },
          data: { status: "CANCELED" },
        });
      }

      // Connexions et jetons.
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.account.deleteMany({ where: { userId: user.id } });
      await tx.verificationToken.deleteMany({
        where: { identifier: { in: [`reset:${lowerEmail}`, `verify:${lowerEmail}`] } },
      });
      await tx.loginAttempt.deleteMany({ where: { email: lowerEmail } });

      // Messages du formulaire de contact.
      await tx.contactMessage.deleteMany({
        where: {
          OR: [{ userId: user.id }, { email: { equals: user.email, mode: "insensitive" } }],
        },
      });

      // Avis publiés : supprimés, et la note des ouvrages concernés est recalculée.
      const reviewedProducts = await tx.review.findMany({
        where: { userId: user.id },
        select: { productId: true },
      });

      if (reviewedProducts.length > 0) {
        await tx.review.deleteMany({ where: { userId: user.id } });

        const productIds = Array.from(
          new Set(reviewedProducts.map((review) => review.productId))
        );
        for (const productId of productIds) {
          await recomputeProductRating(productId, tx);
        }
      }

      // Support : les conversations jamais payées sont supprimées ; pour les autres,
      // le contenu des messages est supprimé et seule la trace du paiement est conservée.
      await tx.supportThread.deleteMany({
        where: { userId: user.id, payments: { none: { status: "SUCCEEDED" } } },
      });
      await tx.message.deleteMany({ where: { thread: { userId: user.id } } });
      await tx.supportThread.updateMany({
        where: { userId: user.id },
        data: { subject: "Conversation supprimée", status: "CLOSED", closedAt: now },
      });

      // Profil vendeur : informations personnelles effacées, ouvrages retirés de la vente.
      if (sellerId) {
        await tx.product.updateMany({
          where: { sellerId, status: "PUBLISHED" },
          data: { status: "UNPUBLISHED" },
        });

        await tx.sellerProfile.update({
          where: { id: sellerId },
          data: {
            displayName: "Auteur supprimé",
            slug: `supprime-${randomBytes(5).toString("hex")}`,
            bio: null,
            avatarUrl: null,
            payoutMobileNumber: null,
            payoutMobileOperator: null,
            payoutBankDetails: null,
            status: "SUSPENDED",
          },
        });
      }

      // Commandes conservées, sans l'adresse email.
      const placeholderEmail = `efface-${user.id}@${ERASED_EMAIL_DOMAIN}`;
      await tx.order.updateMany({
        where: { buyerId: user.id },
        data: { buyerEmail: placeholderEmail },
      });
      const ordersKept = await tx.order.count({ where: { buyerId: user.id } });

      // Compte anonymisé et désactivé ; passwordChangedAt coupe toute session encore ouverte.
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: "Compte supprimé",
          email: placeholderEmail,
          emailVerified: null,
          phone: null,
          image: null,
          passwordHash: null,
          passwordChangedAt: now,
          isActive: false,
        },
      });

      const result: { ok: true; outcome: ErasureOutcome } = {
        ok: true,
        outcome: {
          role: user.role,
          ordersKept,
          previousEmail: user.email,
          previousName: user.name,
        },
      };
      return result;
    },
    { timeout: 30000, maxWait: 15000 }
  );

  if (!outcome.ok) {
    return { ok: false, reason: outcome.reason };
  }

  // Confirmation par email à l'ancienne adresse (au mieux : un échec n'annule rien).
  await sendEmail({
    to: outcome.outcome.previousEmail,
    subject: "Votre compte TechLibrairie a été supprimé",
    content: {
      title: "Compte supprimé",
      paragraphs: [
        `Bonjour${outcome.outcome.previousName ? ` ${outcome.outcome.previousName}` : ""}, votre compte TechLibrairie a été supprimé et vos données personnelles ont été effacées ou anonymisées.`,
        "Certaines informations liées à vos commandes (numéros, montants, dates) sont conservées de façon anonyme pour nos obligations comptables.",
      ],
      note: "Si vous n'êtes pas à l'origine de cette suppression, contactez-nous immédiatement.",
    },
  });

  return { ok: true, role: outcome.outcome.role, ordersKept: outcome.outcome.ordersKept };
            }
