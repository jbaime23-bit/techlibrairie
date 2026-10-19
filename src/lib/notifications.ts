// src/lib/notifications.ts
// Notifications par email. Chaque fonction est autonome : elle relit les données
// en base, ne lève jamais d'exception et ne bloque jamais l'opération appelante.

import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { PAYOUT_HOLD_DAYS } from "@/lib/payouts";
import { formatDate, formatPrice } from "@/lib/utils";
import {
  getEmailAppUrl,
  isEmailConfigured,
  sendEmail,
  type EmailItem,
} from "@/lib/email";

const MAX_SELLER_EMAILS = 10;

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Question générale",
  TECHNICAL: "Problème technique",
  PAYMENT: "Paiement ou commande",
  SELLER_ACCOUNT: "Compte vendeur",
  OTHER: "Autre demande",
};

/** URL du site si l'envoi d'emails est possible, sinon null. */
function readyAppUrl(): string | null {
  if (!isEmailConfigured()) return null;
  return getEmailAppUrl();
}

/** Adresses qui reçoivent les alertes de l'équipe. */
async function getAdminRecipients(): Promise<string[]> {
  const contact = await getContactInfo();
  if (contact.email) return [contact.email];

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { email: true },
    take: 5,
  });
  return admins.map((admin) => admin.email);
}

/** Paiement confirmé : email à l'acheteur (liens de téléchargement) et à chaque vendeur. */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        promoCode: { select: { code: true } },
        items: {
          include: {
            downloads: { orderBy: { createdAt: "desc" }, take: 1 },
            seller: {
              select: {
                id: true,
                displayName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
    });

    if (!order || order.status !== "PAID") return;

    const buyerItems: EmailItem[] = order.items.map((item) => {
      const download = item.downloads[0];
      return {
        label: item.productTitle,
        detail: formatPrice(item.unitAmount, item.currency),
        url: download ? `${appUrl}/api/telechargement/${download.token}` : undefined,
      };
    });

    const firstDownload = order.items
      .map((item) => item.downloads[0])
      .find((download) => download !== undefined);

    const buyerParagraphs = [
      `Merci pour votre achat ! Votre paiement de ${formatPrice(order.totalAmount, order.currency)} est confirmé (commande ${order.number}).`,
    ];

    if (order.discountAmount > 0) {
      buyerParagraphs.push(
        `${order.promoCode ? `Code promotionnel ${order.promoCode.code}` : "Code promotionnel"} : une remise de ${formatPrice(order.discountAmount, order.currency)} a été appliquée (prix avant remise : ${formatPrice(order.totalAmount + order.discountAmount, order.currency)}). Les prix indiqués ci-dessous sont les prix après remise.`
      );
    }

    buyerParagraphs.push(
      "Cliquez sur le titre d'un ouvrage pour le télécharger. Vous devez être connecté à votre compte."
    );

    await sendEmail({
      to: order.buyerEmail,
      subject: `Votre commande ${order.number} est confirmée`,
      idempotencyKey: `order-paid-${order.id}`,
      content: {
        title: "Paiement confirmé",
        paragraphs: buyerParagraphs,
        items: buyerItems,
        button: { label: "Voir mes commandes", url: `${appUrl}/acheteur/commandes` },
        note: firstDownload
          ? `Les liens ci-dessus sont valables jusqu'au ${formatDate(firstDownload.expiresAt)}. Vous pouvez en générer de nouveaux à tout moment depuis « Mes commandes ».`
          : "Vous retrouverez vos liens de téléchargement dans « Mes commandes ».",
      },
    });

    const bySeller = new Map<string, { name: string; email: string; items: EmailItem[] }>();
    for (const item of order.items) {
      const entry = bySeller.get(item.seller.id) ?? {
        name: item.seller.displayName,
        email: item.seller.user.email,
        items: [],
      };
      entry.items.push({
        label: item.productTitle,
        detail: `vos gains : ${formatPrice(item.sellerAmount, item.currency)}`,
      });
      bySeller.set(item.seller.id, entry);
    }

    let sent = 0;
    for (const [sellerId, entry] of Array.from(bySeller.entries())) {
      if (sent >= MAX_SELLER_EMAILS) break;
      sent += 1;

      await sendEmail({
        to: entry.email,
        subject: "Nouvelle vente sur TechLibrairie",
        idempotencyKey: `sale-${order.id}-${sellerId}`,
        content: {
          title: "Nouvelle vente",
          paragraphs: [
            `Bonjour ${entry.name}, félicitations : vous venez de réaliser une vente (commande ${order.number}).`,
          ],
          items: entry.items,
          button: { label: "Voir mes revenus", url: `${appUrl}/vendeur/revenus` },
          note: `Vos gains deviennent retirables ${PAYOUT_HOLD_DAYS} jours après la vente.`,
        },
      });
    }
  } catch (error) {
    console.error("Notification (commande payée) impossible :", error);
  }
}

/** Commande remboursée : email à l'acheteur et à chaque vendeur concerné. */
export async function notifyOrderRefunded(
  orderId: string,
  method: string
): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            seller: {
              select: {
                id: true,
                displayName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
        payments: { where: { status: "REFUNDED" }, take: 1 },
      },
    });

    if (!order || order.status !== "REFUNDED") return;

    const payment = order.payments[0];
    const amountLabel = payment
      ? formatPrice(payment.amount, payment.currency)
      : formatPrice(order.totalAmount, order.currency);

    const isStripeCard = method.startsWith("stripe");
    const isCinetPayCard = method === "manuel-cinetpay-carte";

    const refundParagraph = isStripeCard
      ? "Le montant est remboursé sur votre carte bancaire. Selon votre banque, il peut apparaître avec un délai de plusieurs jours."
      : isCinetPayCard
        ? "Le remboursement de votre paiement par carte a été effectué par notre prestataire de paiement. Selon votre banque, il peut apparaître avec un délai de plusieurs jours."
        : "Le remboursement a été envoyé sur votre compte Mobile Money.";

    await sendEmail({
      to: order.buyerEmail,
      subject: `Votre commande ${order.number} a été remboursée`,
      idempotencyKey: `order-refund-${order.id}`,
      content: {
        title: "Commande remboursée",
        paragraphs: [
          `Votre commande ${order.number} a été remboursée pour un montant de ${amountLabel}.`,
          refundParagraph,
          "Les liens de téléchargement de cette commande ne sont plus valables.",
        ],
        items: order.items.map((item) => ({ label: item.productTitle })),
        button: { label: "Voir mes commandes", url: `${appUrl}/acheteur/commandes` },
      },
    });

    const bySeller = new Map<string, { name: string; email: string; items: EmailItem[] }>();
    for (const item of order.items) {
      const entry = bySeller.get(item.seller.id) ?? {
        name: item.seller.displayName,
        email: item.seller.user.email,
        items: [],
      };
      entry.items.push({
        label: item.productTitle,
        detail: `gains retirés : ${formatPrice(item.sellerAmount, item.currency)}`,
      });
      bySeller.set(item.seller.id, entry);
    }

    let sent = 0;
    for (const [sellerId, entry] of Array.from(bySeller.entries())) {
      if (sent >= MAX_SELLER_EMAILS) break;
      sent += 1;

      await sendEmail({
        to: entry.email,
        subject: "Une de vos ventes a été remboursée",
        idempotencyKey: `refund-${order.id}-${sellerId}`,
        content: {
          title: "Vente remboursée",
          paragraphs: [
            `Bonjour ${entry.name}, la commande ${order.number} a été remboursée à l'acheteur. Les gains correspondants ont été retirés de votre solde.`,
          ],
          items: entry.items,
          button: { label: "Voir mes revenus", url: `${appUrl}/vendeur/revenus` },
        },
      });
    }
  } catch (error) {
    console.error("Notification (remboursement) impossible :", error);
  }
}

/** Réponse de l'équipe : email à l'utilisateur (sans le texte du message). */
export async function notifySupportStaffReply(threadId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        number: true,
        subject: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!thread) return;

    await sendEmail({
      to: thread.user.email,
      subject: `Réponse à votre demande ${thread.number}`,
      content: {
        title: "L'équipe a répondu à votre demande",
        paragraphs: [
          `Bonjour${thread.user.name ? ` ${thread.user.name}` : ""}, l'équipe TechLibrairie a répondu à votre conversation « ${thread.subject} » (${thread.number}).`,
          "Connectez-vous pour lire la réponse et poursuivre l'échange.",
        ],
        button: { label: "Lire la réponse", url: `${appUrl}/support/${thread.id}` },
      },
    });
  } catch (error) {
    console.error("Notification (réponse du support) impossible :", error);
  }
}

/** Nouvelle conversation de support payée (ou gratuite) : alerte pour l'équipe. */
export async function notifyAdminsNewSupportThread(threadId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        number: true,
        subject: true,
        category: true,
        user: { select: { name: true, email: true, role: true } },
      },
    });

    if (!thread) return;

    const recipients = await getAdminRecipients();
    if (recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Nouvelle conversation de support ${thread.number}`,
      idempotencyKey: `support-new-${thread.id}`,
      content: {
        title: "Nouvelle conversation de support",
        paragraphs: ["Une nouvelle conversation de support est à traiter."],
        items: [
          { label: "Numéro", detail: thread.number },
          { label: "Sujet", detail: thread.subject },
          { label: "Catégorie", detail: CATEGORY_LABELS[thread.category] ?? thread.category },
          {
            label: "Utilisateur",
            detail: `${thread.user.name ?? "Sans nom"} (${thread.user.email}, ${thread.user.role === "SELLER" ? "vendeur" : "acheteur"})`,
          },
        ],
        button: { label: "Ouvrir la conversation", url: `${appUrl}/admin/support/${thread.id}` },
      },
    });
  } catch (error) {
    console.error("Notification (nouveau support) impossible :", error);
  }
}

/** L'utilisateur a répondu après une réponse de l'équipe : alerte pour l'équipe. */
export async function notifyAdminsUserReply(threadId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        number: true,
        subject: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!thread) return;

    const recipients = await getAdminRecipients();
    if (recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Nouveau message sur la conversation ${thread.number}`,
      content: {
        title: "Nouveau message d'un utilisateur",
        paragraphs: [
          `${thread.user.name ?? thread.user.email} a répondu à la conversation « ${thread.subject} » (${thread.number}).`,
        ],
        button: { label: "Ouvrir la conversation", url: `${appUrl}/admin/support/${thread.id}` },
      },
    });
  } catch (error) {
    console.error("Notification (réponse utilisateur) impossible :", error);
  }
}

/** Message reçu par le formulaire de contact : alerte pour l'équipe (réponse directe possible). */
export async function notifyAdminsNewContact(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const recipients = await getAdminRecipients();
    if (recipients.length === 0) return;

    const excerpt =
      params.message.length > 600 ? `${params.message.slice(0, 600)}...` : params.message;

    await sendEmail({
      to: recipients,
      subject: `Contact : ${params.subject}`,
      replyTo: params.email,
      content: {
        title: "Nouveau message de contact",
        paragraphs: ["Message reçu via le formulaire de contact du site :", excerpt],
        items: [
          { label: "Nom", detail: params.name },
          { label: "Email", detail: params.email },
          { label: "Sujet", detail: params.subject },
        ],
        button: { label: "Voir les messages", url: `${appUrl}/admin/messages` },
        note: "Vous pouvez répondre directement à cet email : la réponse est envoyée à l'expéditeur.",
      },
    });
  } catch (error) {
    console.error("Notification (message de contact) impossible :", error);
  }
}

/** Extrait la destination d'un versement depuis sa note ("Destination : Orange Money +226 ..."). */
function extractDestination(note: string | null): string | null {
  if (!note) return null;
  const first = note.split(" | ")[0];
  const prefix = "Destination : ";
  return first.startsWith(prefix) ? first.slice(prefix.length) : null;
}

/** Versement effectué : email au vendeur. */
export async function notifyPayoutPaid(payoutId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        seller: {
          select: { displayName: true, user: { select: { email: true } } },
        },
      },
    });

    if (!payout || payout.status !== "PAID") return;

    const destination = extractDestination(payout.note);
    const items: EmailItem[] = [
      { label: "Montant", detail: formatPrice(payout.amount, payout.currency) },
    ];
    if (destination) items.push({ label: "Destination", detail: destination });
    if (payout.reference) items.push({ label: "Référence", detail: payout.reference });
    if (payout.paidAt) items.push({ label: "Date", detail: formatDate(payout.paidAt) });

    await sendEmail({
      to: payout.seller.user.email,
      subject: "Votre versement a été effectué",
      idempotencyKey: `payout-paid-${payout.id}`,
      content: {
        title: "Versement effectué",
        paragraphs: [
          `Bonjour ${payout.seller.displayName}, votre demande de versement a été traitée : l'argent a été envoyé.`,
        ],
        items,
        button: { label: "Voir mes revenus", url: `${appUrl}/vendeur/revenus` },
      },
    });
  } catch (error) {
    console.error("Notification (versement effectué) impossible :", error);
  }
}

/** Versement refusé : email au vendeur avec le motif. */
export async function notifyPayoutRejected(
  payoutId: string,
  reason: string
): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        seller: {
          select: { displayName: true, user: { select: { email: true } } },
        },
      },
    });

    if (!payout || payout.status !== "FAILED") return;

    await sendEmail({
      to: payout.seller.user.email,
      subject: "Votre demande de versement a été refusée",
      idempotencyKey: `payout-rejected-${payout.id}`,
      content: {
        title: "Demande de versement refusée",
        paragraphs: [
          `Bonjour ${payout.seller.displayName}, votre demande de versement de ${formatPrice(payout.amount, payout.currency)} a été refusée.`,
          `Motif : ${reason}`,
          "Le montant est de nouveau disponible dans votre solde : vous pouvez effectuer une nouvelle demande.",
        ],
        button: { label: "Voir mes revenus", url: `${appUrl}/vendeur/revenus` },
      },
    });
  } catch (error) {
    console.error("Notification (versement refusé) impossible :", error);
  }
                                                  }
