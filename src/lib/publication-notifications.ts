// src/lib/publication-notifications.ts
// Emails de la mise en ligne des ouvrages (validation par TechLibrairie). Chaque fonction relit les données,
// ne lève jamais d'exception et ne bloque jamais l'opération appelante. Sans envoi d'emails configuré,
// elle ne fait rien.

import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { getEmailAppUrl, isEmailConfigured, sendEmail } from "@/lib/email";

interface ProductInfo {
  title: string;
  slug: string;
  isBook: boolean;
  sellerName: string;
  sellerEmail: string;
}

async function loadProduct(productId: string): Promise<ProductInfo | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      slug: true,
      kind: true,
      seller: { select: { displayName: true, user: { select: { email: true } } } },
    },
  });

  if (!product) return null;

  return {
    title: product.title,
    slug: product.slug,
    isBook: product.kind === "BOOK_EDITION",
    sellerName: product.seller.displayName,
    sellerEmail: product.seller.user.email,
  };
}

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

/** Un ouvrage vient d'être déposé : à valider avant toute mise en vente. */
export async function notifyAdminsReviewNeeded(productId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const info = await loadProduct(productId);
    const recipients = await adminRecipients();
    if (!info || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Ouvrage à valider : ${info.title}`,
      content: {
        title: "Un ouvrage attend votre validation",
        paragraphs: [
          `${info.sellerName} a déposé « ${info.title} ». Il reste invisible dans la boutique tant que vous ne l'avez pas validé.`,
        ],
        button: { label: "Ouvrir la mise en ligne", url: `${getEmailAppUrl()}/admin/mise-en-ligne` },
      },
    });
  } catch (error) {
    console.error("Notification (ouvrage à valider) impossible :", error);
  }
}

/** L'auteur a approuvé le bon à tirer : le livre est prêt à être mis en ligne. */
export async function notifyAdminsReadyToPublish(productId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const info = await loadProduct(productId);
    const recipients = await adminRecipients();
    if (!info || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Livre prêt à publier : ${info.title}`,
      content: {
        title: "Un livre est prêt à être mis en ligne",
        paragraphs: [
          `${info.sellerName} a approuvé le bon à tirer de « ${info.title} ». Le livre n'est pas encore en vente : à vous de le mettre en ligne.`,
        ],
        button: { label: "Ouvrir la mise en ligne", url: `${getEmailAppUrl()}/admin/mise-en-ligne` },
      },
    });
  } catch (error) {
    console.error("Notification (livre prêt à publier) impossible :", error);
  }
}

/** Accusé de réception de l'approbation du bon à tirer. */
export async function notifySellerProofApproved(productId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const info = await loadProduct(productId);
    if (!info) return;

    await sendEmail({
      to: info.sellerEmail,
      subject: `Bon à tirer approuvé : « ${info.title} »`,
      idempotencyKey: `proof-approved-${productId}`,
      content: {
        title: "Nous avons bien reçu votre approbation",
        paragraphs: [
          `Vous avez approuvé le bon à tirer de « ${info.title} ».`,
          "TechLibrairie Édition procède à la vérification finale, puis met votre livre en ligne. Vous serez prévenu dès sa publication.",
        ],
        button: { label: "Suivre mon édition", url: `${getEmailAppUrl()}/vendeur/publication/${productId}` },
      },
    });
  } catch (error) {
    console.error("Notification (approbation du bon à tirer) impossible :", error);
  }
}

/** L'ouvrage est publié par TechLibrairie. */
export async function notifySellerProductPublished(productId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const info = await loadProduct(productId);
    if (!info) return;

    await sendEmail({
      to: info.sellerEmail,
      subject: `Votre ouvrage est en ligne : « ${info.title} »`,
      idempotencyKey: `product-published-${productId}`,
      content: {
        title: "Votre ouvrage est en vente",
        paragraphs: [
          info.isBook
            ? `« ${info.title} » est maintenant en vente sur TechLibrairie. Vous gardez vos droits et 100 % du produit net de vos ventes.`
            : `« ${info.title} » a été validé par TechLibrairie : il est maintenant en vente.`,
        ],
        button: { label: "Voir la page", url: `${getEmailAppUrl()}/catalogue/${info.slug}` },
      },
    });
  } catch (error) {
    console.error("Notification (ouvrage publié) impossible :", error);
  }
}

/** L'ouvrage n'est pas retenu pour la mise en vente. */
export async function notifySellerProductRejected(productId: string, reason: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const info = await loadProduct(productId);
    if (!info) return;

    await sendEmail({
      to: info.sellerEmail,
      subject: `Votre ouvrage n'a pas été validé : « ${info.title} »`,
      content: {
        title: "Votre ouvrage n'a pas été validé",
        paragraphs: [
          `Après vérification, « ${info.title} » n'a pas pu être mis en vente.`,
          `Motif : ${reason}`,
          "Vous pouvez nous contacter pour en discuter ou déposer une version corrigée.",
        ],
        button: { label: "Mes ouvrages", url: `${getEmailAppUrl()}/vendeur/produits` },
      },
    });
  } catch (error) {
    console.error("Notification (ouvrage refusé) impossible :", error);
  }
}
