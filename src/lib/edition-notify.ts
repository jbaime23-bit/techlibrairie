// src/lib/edition-notify.ts
// Emails du circuit d'édition à compte d'auteur. Chaque fonction est autonome : elle ne lève jamais
// d'exception et ne bloque jamais l'opération appelante.

import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { getEmailAppUrl, isEmailConfigured, sendEmail } from "@/lib/email";

const MAX_ADMIN_RECIPIENTS = 5;

function appUrl(): string | null {
  return isEmailConfigured() ? getEmailAppUrl() : null;
}

async function adminRecipients(): Promise<string[]> {
  const contact = await getContactInfo();
  if (contact.email) return [contact.email];

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { email: true },
    take: MAX_ADMIN_RECIPIENTS,
  });

  return admins.map((admin) => admin.email);
}

/** L'épreuve (bon à tirer) est prête : l'auteur est invité à la relire. */
export async function notifyAuthorProofReady(params: {
  to: string;
  productId: string;
  title: string;
  version: number;
}): Promise<void> {
  try {
    const url = appUrl();
    if (!url) return;

    await sendEmail({
      to: params.to,
      subject: `Votre épreuve est prête : « ${params.title} »`,
      idempotencyKey: `edition-proof-${params.productId}-v${params.version}`,
      content: {
        title: "Votre épreuve est prête",
        paragraphs: [
          `La mise en page de votre livre « ${params.title} » est terminée (épreuve, version ${params.version}).`,
          "Relisez-la attentivement : vous pouvez l'approuver pour publier votre livre, ou demander des corrections. Rien n'est publié sans votre accord.",
        ],
        button: {
          label: "Relire mon épreuve",
          url: `${url}/vendeur/publication/${params.productId}`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (épreuve prête) impossible :", error);
  }
}

/** L'auteur demande des corrections : l'équipe est prévenue. */
export async function notifyAdminsChangesRequested(params: {
  productId: string;
  title: string;
  authorEmail: string;
  round: number;
  message: string;
}): Promise<void> {
  try {
    const url = appUrl();
    if (!url) return;

    const recipients = await adminRecipients();
    if (recipients.length === 0) return;

    const excerpt = params.message.length > 600 ? `${params.message.slice(0, 600)}...` : params.message;

    await sendEmail({
      to: recipients,
      subject: `Corrections demandées : « ${params.title} »`,
      idempotencyKey: `edition-changes-${params.productId}-r${params.round}`,
      replyTo: params.authorEmail,
      content: {
        title: "Corrections demandées par un auteur",
        paragraphs: [
          `L'auteur de « ${params.title} » demande des corrections (série n°${params.round}) :`,
          excerpt,
        ],
        button: { label: "Ouvrir la file des éditions", url: `${url}/admin/editions` },
      },
    });
  } catch (error) {
    console.error("Notification (corrections demandées) impossible :", error);
  }
}

/** L'auteur approuve le bon à tirer : l'équipe est prévenue, puis l'auteur reçoit la confirmation. */
export async function notifyProofApproved(params: {
  productId: string;
  title: string;
  slug: string;
  authorEmail: string;
  version: number;
}): Promise<void> {
  try {
    const url = appUrl();
    if (!url) return;

    const recipients = await adminRecipients();
    if (recipients.length > 0) {
      await sendEmail({
        to: recipients,
        subject: `Bon à tirer approuvé : « ${params.title} »`,
        idempotencyKey: `edition-approved-admin-${params.productId}`,
        content: {
          title: "Bon à tirer approuvé : livre publié",
          paragraphs: [
            `L'auteur a approuvé l'épreuve (version ${params.version}) de « ${params.title} ». Le livre est publié.`,
          ],
          button: { label: "Voir la page du livre", url: `${url}/catalogue/${params.slug}` },
        },
      });
    }

    await sendEmail({
      to: params.authorEmail,
      subject: `Votre livre est publié : « ${params.title} »`,
      idempotencyKey: `edition-published-${params.productId}`,
      content: {
        title: "Votre livre est publié",
        paragraphs: [
          `Félicitations : « ${params.title} » est maintenant disponible sur TechLibrairie.`,
          "Vous gardez vos droits et 100 % de vos gains. Vous suivez vos ventes depuis votre espace vendeur.",
        ],
        button: { label: "Voir la page de mon livre", url: `${url}/catalogue/${params.slug}` },
      },
    });
  } catch (error) {
    console.error("Notification (épreuve approuvée) impossible :", error);
  }
}

/** L'œuvre est refusée : l'auteur est prévenu, avec le motif et, le cas échéant, le remboursement. */
export async function notifyAuthorRefused(params: {
  to: string;
  productId: string;
  title: string;
  reason: string;
}): Promise<void> {
  try {
    const url = appUrl();
    if (!url) return;

    await sendEmail({
      to: params.to,
      subject: `Votre livre n'a pas pu être retenu : « ${params.title} »`,
      idempotencyKey: `edition-refused-${params.productId}`,
      content: {
        title: "Votre livre n'a pas pu être retenu",
        paragraphs: [
          `Après contrôle, « ${params.title} » n'a pas pu être retenu pour l'édition.`,
          `Motif : ${params.reason}`,
          "Si vous aviez réglé le forfait d'édition, il vous est remboursé intégralement.",
        ],
        button: { label: "Voir mon suivi", url: `${url}/vendeur/publication/${params.productId}` },
      },
    });
  } catch (error) {
    console.error("Notification (œuvre refusée) impossible :", error);
  }
                                                   }
