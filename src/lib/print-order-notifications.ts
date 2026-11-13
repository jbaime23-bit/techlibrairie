// src/lib/print-order-notifications.ts
// Emails des commandes d'exemplaires imprimés. Chaque fonction relit les données, ne lève jamais
// d'exception et ne bloque jamais l'opération appelante. Sans envoi d'emails configuré, elle ne fait rien.

import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { getEmailAppUrl, isEmailConfigured, sendEmail } from "@/lib/email";

async function adminRecipients(): Promise<string[]> {
  const contact = await getContactInfo();
  if (contact.email) return [contact.email];

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { email: true },
    take: 5,
  });

  return admins.map((admin) => admin.email);
}

/** L'acheteur a déclaré son paiement : à vérifier. */
export async function notifyAdminsPrintPaymentDeclared(orderId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const order = await prisma.printOrder.findUnique({ where: { id: orderId } });
    const recipients = await adminRecipients();
    if (!order || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Commande imprimée à vérifier : ${order.number}`,
      content: {
        title: "Un paiement de livre imprimé à vérifier",
        paragraphs: [
          `${order.buyerEmail} a déclaré le paiement de la commande ${order.number} : ${order.quantity} exemplaire(s) de « ${order.productTitle} », total ${order.totalXof.toLocaleString("fr-FR")} FCFA.`,
          "Vérifiez la réception sur votre compte, puis validez ou rejetez le paiement.",
        ],
        button: {
          label: "Ouvrir les paiements à vérifier",
          url: `${getEmailAppUrl()}/admin/impressions?statut=paiement`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (paiement imprimé déclaré) impossible :", error);
  }
}

/** L'envoi d'une commande payée a échoué : à corriger puis relancer. */
export async function notifyAdminsPrintDispatchError(orderId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const order = await prisma.printOrder.findUnique({ where: { id: orderId } });
    const recipients = await adminRecipients();
    if (!order || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Envoi d'impression en erreur : ${order.number}`,
      content: {
        title: "Une commande imprimée n'a pas pu être envoyée",
        paragraphs: [
          `La commande ${order.number} (« ${order.productTitle} ») est payée mais son envoi n'a pas abouti.`,
          order.lastDispatchError ?? "Cause inconnue.",
        ],
        button: {
          label: "Ouvrir les envois à corriger",
          url: `${getEmailAppUrl()}/admin/impressions?statut=envoi`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (envoi imprimé en erreur) impossible :", error);
  }
}

/** Le paiement est validé : la commande est en préparation. */
export async function notifyBuyerPrintPaid(orderId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const order = await prisma.printOrder.findUnique({ where: { id: orderId } });
    if (!order) return;

    await sendEmail({
      to: order.buyerEmail,
      subject: `Paiement reçu : commande ${order.number}`,
      idempotencyKey: `print-paid-${order.id}`,
      content: {
        title: "Nous avons bien reçu votre paiement",
        paragraphs: [
          `Votre commande ${order.number} (${order.quantity} exemplaire(s) de « ${order.productTitle} ») est en préparation.`,
          "Chaque exemplaire est fabriqué à la commande. Vous recevrez un message dès son expédition.",
        ],
        button: {
          label: "Suivre ma commande",
          url: `${getEmailAppUrl()}/acheteur/impression/${order.number}`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (commande imprimée payée) impossible :", error);
  }
}

/** Le paiement déclaré n'a pas pu être validé. */
export async function notifyBuyerPrintPaymentRejected(orderId: string, reason: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const order = await prisma.printOrder.findUnique({ where: { id: orderId } });
    if (!order) return;

    await sendEmail({
      to: order.buyerEmail,
      subject: `Paiement non validé : commande ${order.number}`,
      content: {
        title: "Votre paiement n'a pas pu être validé",
        paragraphs: [
          `Le paiement déclaré pour la commande ${order.number} n'a pas pu être validé.`,
          `Motif : ${reason}`,
          "Vérifiez les informations, puis déclarez-le à nouveau depuis votre commande.",
        ],
        button: {
          label: "Ouvrir ma commande",
          url: `${getEmailAppUrl()}/acheteur/impression/${order.number}`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (paiement imprimé rejeté) impossible :", error);
  }
}

/** La commande est expédiée. */
export async function notifyBuyerPrintShipped(orderId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const order = await prisma.printOrder.findUnique({ where: { id: orderId } });
    if (!order) return;

    const tracking = (order.trackingUrls ?? "").split("\n").filter((line) => line.trim() !== "");

    await sendEmail({
      to: order.buyerEmail,
      subject: `Commande expédiée : ${order.number}`,
      idempotencyKey: `print-shipped-${order.id}`,
      content: {
        title: "Votre commande est expédiée",
        paragraphs: [
          `Votre commande ${order.number} (« ${order.productTitle} ») a été expédiée.`,
          ...(order.fulfilmentNote ? [order.fulfilmentNote] : []),
          ...(tracking.length > 0 ? [`Suivi du colis : ${tracking.join(" ")}`] : []),
        ],
        button: {
          label: "Voir ma commande",
          url: `${getEmailAppUrl()}/acheteur/impression/${order.number}`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (commande imprimée expédiée) impossible :", error);
  }
}
