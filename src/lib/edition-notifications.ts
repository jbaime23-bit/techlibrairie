// src/lib/edition-notifications.ts
// Emails du circuit d'édition à compte d'auteur. Chaque fonction est autonome : elle relit les données,
// ne lève jamais d'exception et ne bloque jamais l'opération appelante. Sans envoi d'emails configuré,
// elle ne fait rien.

import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { getEmailAppUrl, isEmailConfigured, sendEmail } from "@/lib/email";

function readyAppUrl(): string | null {
  if (!isEmailConfigured()) return null;
  return getEmailAppUrl();
}

interface EditionInfo {
  title: string;
  slug: string;
  sellerName: string;
  authorEmail: string;
}

async function loadEdition(productId: string): Promise<EditionInfo | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      slug: true,
      seller: {
        select: { displayName: true, user: { select: { email: true } } },
      },
    },
  });

  if (!product) return null;

  return {
    title: product.title,
    slug: product.slug,
    sellerName: product.seller.displayName,
    authorEmail: product.seller.user.email,
  };
}

/** Adresses qui reçoivent les alertes de l'équipe. */
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

/** L'auteur a déclaré son paiement : à vérifier par l'administration. */
export async function notifyAdminsFeeDeclared(productId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const info = await loadEdition(productId);
    const recipients = await adminRecipients();
    if (!info || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Forfait d'édition à vérifier : ${info.title}`,
      content: {
        title: "Un forfait d'édition à vérifier",
        paragraphs: [
          `${info.sellerName} a déclaré le paiement du forfait d'édition de son livre « ${info.title} ».`,
          "Vérifiez la réception sur votre application Mobile Money, puis validez ou rejetez le paiement.",
        ],
        button: {
          label: "Ouvrir les paiements à vérifier",
          url: `${appUrl}/admin/publications?statut=paiement`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (forfait déclaré) impossible :", error);
  }
}

/** Le forfait est validé : la mise en page commence. */
export async function notifyAuthorFeeValidated(productId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const info = await loadEdition(productId);
    if (!info) return;

    await sendEmail({
      to: info.authorEmail,
      subject: `Forfait validé : l'édition de « ${info.title} » commence`,
      idempotencyKey: `edition-fee-validated-${productId}`,
      content: {
        title: "Votre forfait est validé",
        paragraphs: [
          `Nous avons bien reçu le forfait d'édition de votre livre « ${info.title} ».`,
          "TechLibrairie Édition contrôle votre livre puis réalise sa mise en page (délai indicatif de 30 jours). Vous recevrez l'épreuve à approuver avant toute publication.",
        ],
        button: { label: "Suivre mon édition", url: `${appUrl}/vendeur/publication/${productId}` },
      },
    });
  } catch (error) {
    console.error("Notification (forfait validé) impossible :", error);
  }
}

/** Le paiement déclaré n'a pas pu être validé. */
export async function notifyAuthorFeeRejected(productId: string, reason: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const info = await loadEdition(productId);
    if (!info) return;

    await sendEmail({
      to: info.authorEmail,
      subject: `Paiement non validé : « ${info.title} »`,
      content: {
        title: "Votre paiement n'a pas pu être validé",
        paragraphs: [
          `Le paiement déclaré pour le forfait d'édition de « ${info.title} » n'a pas pu être validé.`,
          `Motif : ${reason}`,
          "Vérifiez les informations, puis déclarez-le à nouveau depuis votre espace.",
        ],
        button: { label: "Déclarer à nouveau", url: `${appUrl}/vendeur/publication/${productId}` },
      },
    });
  } catch (error) {
    console.error("Notification (paiement rejeté) impossible :", error);
  }
}

/** Une épreuve est prête : l'auteur doit l'approuver ou demander des corrections. */
export async function notifyAuthorProofReady(productId: string, version: number): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const info = await loadEdition(productId);
    if (!info) return;

    await sendEmail({
      to: info.authorEmail,
      subject: `Votre épreuve est prête : « ${info.title} »`,
      idempotencyKey: `edition-proof-${productId}-v${version}`,
      content: {
        title: "Votre épreuve est prête",
        paragraphs: [
          `La mise en page de votre livre « ${info.title} » est terminée (épreuve version ${version}).`,
          "Relisez-la attentivement : vous pouvez l'approuver pour publier votre livre, ou demander des corrections. Rien n'est publié sans votre accord.",
        ],
        button: { label: "Relire mon épreuve", url: `${appUrl}/vendeur/publication/${productId}` },
        note: "Vous disposez de 15 jours pour répondre.",
      },
    });
  } catch (error) {
    console.error("Notification (épreuve prête) impossible :", error);
  }
}

/** L'auteur demande des corrections sur l'épreuve. */
export async function notifyAdminsChangesRequested(
  productId: string,
  round: number,
  message: string
): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const info = await loadEdition(productId);
    const recipients = await adminRecipients();
    if (!info || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Corrections demandées : ${info.title}`,
      content: {
        title: "Corrections demandées sur une épreuve",
        paragraphs: [
          `${info.sellerName} demande des corrections sur « ${info.title} » (série ${round}).`,
          message.length > 600 ? `${message.slice(0, 600)}...` : message,
        ],
        button: { label: "Ouvrir les éditions en maquette", url: `${appUrl}/admin/publications?statut=maquette` },
      },
    });
  } catch (error) {
    console.error("Notification (corrections demandées) impossible :", error);
  }
}

/** Le bon à tirer est approuvé : le livre est publié. */
export async function notifyProofApproved(productId: string): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const info = await loadEdition(productId);
    if (!info) return;

    await sendEmail({
      to: info.authorEmail,
      subject: `Votre livre est publié : « ${info.title} »`,
      idempotencyKey: `edition-published-${productId}`,
      content: {
        title: "Votre livre est publié",
        paragraphs: [
          `Vous avez approuvé le bon à tirer : « ${info.title} » est maintenant en vente sur TechLibrairie.`,
          "Vous gardez vos droits et 100 % du produit net de vos ventes.",
        ],
        button: { label: "Voir mon livre", url: `${appUrl}/catalogue/${info.slug}` },
      },
    });

    const recipients = await adminRecipients();
    if (recipients.length > 0) {
      await sendEmail({
        to: recipients,
        subject: `Bon à tirer approuvé : ${info.title}`,
        content: {
          title: "Un livre vient d'être publié",
          paragraphs: [`${info.sellerName} a approuvé le bon à tirer de « ${info.title} » : le livre est en vente.`],
          button: { label: "Voir la page", url: `${appUrl}/catalogue/${info.slug}` },
        },
      });
    }
  } catch (error) {
    console.error("Notification (livre publié) impossible :", error);
  }
}

/** L'œuvre est refusée. */
export async function notifyAuthorRefused(
  productId: string,
  reason: string,
  refundDue: boolean
): Promise<void> {
  try {
    const appUrl = readyAppUrl();
    if (!appUrl) return;

    const info = await loadEdition(productId);
    if (!info) return;

    await sendEmail({
      to: info.authorEmail,
      subject: `Votre livre n'a pas pu être retenu : « ${info.title} »`,
      content: {
        title: "Votre livre n'a pas pu être retenu",
        paragraphs: [
          `Après contrôle, « ${info.title} » n'a pas pu être retenu pour l'édition.`,
          `Motif : ${reason}`,
          refundDue
            ? "Le forfait que vous avez versé vous est remboursé intégralement : l'administration vous contactera pour le remboursement."
            : "Aucun forfait n'avait été validé : rien ne vous est facturé.",
        ],
        button: { label: "Voir le détail", url: `${appUrl}/vendeur/publication/${productId}` },
      },
    });
  } catch (error) {
    console.error("Notification (livre refusé) impossible :", error);
  }
  }
