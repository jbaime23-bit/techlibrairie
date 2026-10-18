// src/lib/reminders.ts
// Rappel par email d'une commande non terminée : un seul email par commande, 3 à 40 heures
// après son début, seulement si l'acheteur n'a pas désactivé l'option.
// Avant chaque envoi, le paiement est revérifié auprès du prestataire (il a peut-être abouti).
// Les envois sont plafonnés pour ne pas épuiser le quota d'emails du site.

import { prisma } from "@/lib/prisma";
import { syncOrderPayments } from "@/lib/orders";
import { getEmailAppUrl, isEmailConfigured, sendEmail } from "@/lib/email";
import { formatPrice } from "@/lib/utils";

const HOUR_MS = 60 * 60 * 1000;
const MIN_AGE_HOURS = 3;
const MAX_AGE_HOURS = 40;
const MAX_REMINDERS_PER_RUN = 20;
const MAX_CANDIDATES = 50;
const DEFAULT_BUDGET_MS = 8000;

export interface ReminderReport {
  emailDisabled: boolean;
  candidates: number;
  sent: number;
  skipped: number;
  recovered: number;
  failed: number;
  timeBudgetExceeded: boolean;
  durationMs: number;
}

export async function sendAbandonedOrderReminders(
  options: { budgetMs?: number } = {}
): Promise<ReminderReport> {
  const startedAt = Date.now();
  const deadline = startedAt + (options.budgetMs ?? DEFAULT_BUDGET_MS);

  const report: ReminderReport = {
    emailDisabled: false,
    candidates: 0,
    sent: 0,
    skipped: 0,
    recovered: 0,
    failed: 0,
    timeBudgetExceeded: false,
    durationMs: 0,
  };

  const appUrl = getEmailAppUrl();
  if (!isEmailConfigured() || !appUrl) {
    report.emailDisabled = true;
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  const now = Date.now();

  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      reminderSentAt: null,
      createdAt: {
        gte: new Date(now - MAX_AGE_HOURS * HOUR_MS),
        lte: new Date(now - MIN_AGE_HOURS * HOUR_MS),
      },
      buyer: { isActive: true, reminderEmails: true },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_CANDIDATES,
    select: {
      id: true,
      number: true,
      buyerId: true,
      buyerEmail: true,
      items: {
        select: {
          productId: true,
          productTitle: true,
          unitAmount: true,
          currency: true,
          product: {
            select: {
              slug: true,
              status: true,
              seller: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  report.candidates = orders.length;

  for (const order of orders) {
    if (Date.now() > deadline) {
      report.timeBudgetExceeded = true;
      break;
    }
    if (report.sent >= MAX_REMINDERS_PER_RUN) break;

    try {
      // Le paiement a peut-être abouti sans que nous l'ayons su : on revérifie d'abord.
      await syncOrderPayments(order.id);

      const fresh = await prisma.order.findUnique({
        where: { id: order.id },
        select: { status: true },
      });

      if (fresh?.status === "PAID") {
        report.recovered += 1;
        continue;
      }
      if (fresh?.status !== "PENDING") {
        report.skipped += 1;
        continue;
      }

      // Ouvrages déjà achetés par ailleurs ou plus en vente : retirés du rappel.
      const alreadyBought = await prisma.orderItem.findMany({
        where: {
          productId: { in: order.items.map((item) => item.productId) },
          order: { buyerId: order.buyerId, status: "PAID" },
        },
        select: { productId: true },
      });
      const boughtIds = new Set(alreadyBought.map((item) => item.productId));

      const remaining = order.items.filter(
        (item) =>
          !boughtIds.has(item.productId) &&
          item.product.status === "PUBLISHED" &&
          item.product.seller.status === "ACTIVE"
      );

      if (remaining.length === 0) {
        // Rien à rappeler : la commande est marquée pour ne plus être examinée.
        await prisma.order.updateMany({
          where: { id: order.id, reminderSentAt: null },
          data: { reminderSentAt: new Date() },
        });
        report.skipped += 1;
        continue;
      }

      // Réservation : une seule exécution peut envoyer le rappel de cette commande.
      const claimed = await prisma.order.updateMany({
        where: { id: order.id, status: "PENDING", reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      if (claimed.count === 0) {
        report.skipped += 1;
        continue;
      }

      const result = await sendEmail({
        to: order.buyerEmail,
        subject: "Votre commande TechLibrairie n'est pas terminée",
        idempotencyKey: `cart-reminder-${order.id}`,
        content: {
          title: "Votre commande n'est pas terminée",
          paragraphs: [
            `Bonjour, vous avez commencé une commande sur TechLibrairie (${order.number}) sans la terminer. Aucun paiement n'a été confirmé : vous n'avez rien à payer tant que vous ne finalisez pas votre achat.`,
            "Les ouvrages suivants vous attendent. Cliquez sur un titre pour rouvrir sa page et le remettre dans votre panier si besoin :",
          ],
          items: remaining.map((item) => ({
            label: item.productTitle,
            detail: formatPrice(item.unitAmount, item.currency),
            url: `${appUrl}/catalogue/${item.product.slug}`,
          })),
          button: { label: "Voir mon panier", url: `${appUrl}/panier` },
          note: `Ce rappel n'est envoyé qu'une seule fois. Pour ne plus en recevoir, décochez « Rappels par email » dans votre profil : ${appUrl}/profil`,
        },
      });

      if (result.ok) {
        report.sent += 1;
      } else {
        // Échec d'envoi : la réservation est levée pour une nouvelle tentative lors d'une prochaine exécution.
        await prisma.order.updateMany({
          where: { id: order.id },
          data: { reminderSentAt: null },
        });
        report.failed += 1;
      }
    } catch (error) {
      console.error(`Rappel de commande ${order.id} impossible :`, error);
      report.failed += 1;
    }
  }

  report.durationMs = Date.now() - startedAt;
  return report;
      }
