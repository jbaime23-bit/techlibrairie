// src/lib/manuscript-notifications.ts
// Emails de l'examen éditorial et du contrat à compte d'éditeur. Chaque fonction relit les données, ne lève
// jamais d'exception et ne bloque jamais l'opération appelante. Sans envoi d'emails configuré, elle ne fait rien.

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

/** Un manuscrit vient d'être soumis : à examiner. */
export async function notifyAdminsManuscriptSubmitted(submissionId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const submission = await prisma.manuscriptSubmission.findUnique({ where: { id: submissionId } });
    const recipients = await adminRecipients();
    if (!submission || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Nouveau manuscrit à examiner : ${submission.title}`,
      content: {
        title: "Un manuscrit est soumis à l'examen éditorial",
        paragraphs: [
          `« ${submission.title} » de ${submission.authorName} vient d'être soumis (formule à compte d'éditeur).`,
          "Téléchargez le manuscrit, examinez-le, puis retenez-le ou refusez-le avec un message.",
        ],
        button: {
          label: "Ouvrir les manuscrits à examiner",
          url: `${getEmailAppUrl()}/admin/manuscrits?statut=examen`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (manuscrit soumis) impossible :", error);
  }
}

/** La décision de l'équipe éditoriale est communiquée à l'auteur (avec le contrat à signer si le manuscrit est retenu). */
export async function notifyAuthorManuscriptDecision(submissionId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const submission = await prisma.manuscriptSubmission.findUnique({ where: { id: submissionId } });
    if (!submission || (submission.status !== "ACCEPTED" && submission.status !== "REJECTED")) return;

    const user = await prisma.user.findUnique({
      where: { id: submission.userId },
      select: { email: true },
    });
    if (!user) return;

    const accepted = submission.status === "ACCEPTED";
    const contract = accepted
      ? await prisma.publisherContract.findUnique({
          where: { submissionId },
          select: { royaltyPercent: true },
        })
      : null;

    await sendEmail({
      to: user.email,
      subject: accepted
        ? `Votre manuscrit est retenu : « ${submission.title} »`
        : `Votre manuscrit n'a pas été retenu : « ${submission.title} »`,
      idempotencyKey: `manuscript-decision-${submission.id}`,
      content: {
        title: accepted ? "Votre manuscrit est retenu" : "Votre manuscrit n'a pas été retenu",
        paragraphs: [
          accepted
            ? `Bonne nouvelle : après examen, TechLibrairie Édition souhaite éditer « ${submission.title} ».`
            : `Après examen, TechLibrairie Édition ne donne pas suite à « ${submission.title} » pour le moment.`,
          ...(submission.decisionMessage ? [submission.decisionMessage] : []),
          accepted
            ? contract
              ? `Votre contrat d'édition est prêt (redevance de ${contract.royaltyPercent} % du prix public hors taxes de chaque exemplaire vendu). Lisez-le et signez-le en ligne depuis votre espace auteur : aucun rendez-vous n'est nécessaire. Vous pourrez ensuite le télécharger en PDF.`
              : "Votre contrat d'édition vous sera proposé très prochainement dans votre espace auteur."
            : "Vous pouvez, si vous le souhaitez, faire éditer ce livre à compte d'auteur : vous gardez alors vos droits et tous vos gains.",
        ],
        button: {
          label: accepted && contract ? "Lire et signer mon contrat" : "Ouvrir mon espace auteur",
          url:
            accepted && contract
              ? `${getEmailAppUrl()}/edition/contrat/${submission.id}`
              : `${getEmailAppUrl()}/edition/espace`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (décision sur un manuscrit) impossible :", error);
  }
}

/** L'auteur a signé son contrat : l'administration est prévenue. */
export async function notifyAdminsPublisherContractSigned(submissionId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const contract = await prisma.publisherContract.findUnique({ where: { submissionId } });
    const recipients = await adminRecipients();
    if (!contract || recipients.length === 0) return;

    await sendEmail({
      to: recipients,
      subject: `Contrat d'édition signé : ${contract.workTitle}`,
      content: {
        title: "Un contrat d'édition à compte d'éditeur est signé",
        paragraphs: [
          `${contract.signerName ?? "L'auteur"} a signé le contrat de « ${contract.workTitle} » (redevance de ${contract.royaltyPercent} %).`,
          "Vous pouvez lancer l'édition du livre.",
        ],
        button: {
          label: "Ouvrir les manuscrits retenus",
          url: `${getEmailAppUrl()}/admin/manuscrits?statut=retenus`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (contrat signé, administration) impossible :", error);
  }
}

/** Confirmation de signature à l'auteur, avec le lien de téléchargement du PDF. */
export async function notifyAuthorPublisherContractSigned(submissionId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;

    const contract = await prisma.publisherContract.findUnique({ where: { submissionId } });
    if (!contract || !contract.signerEmail) return;

    await sendEmail({
      to: contract.signerEmail,
      subject: `Votre contrat d'édition est signé : « ${contract.workTitle} »`,
      idempotencyKey: `publisher-contract-signed-${submissionId}`,
      content: {
        title: "Votre contrat est signé",
        paragraphs: [
          `Vous avez signé le contrat d'édition de « ${contract.workTitle} ». Conservez-en un exemplaire : vous pouvez le télécharger en PDF à tout moment depuis votre espace auteur.`,
          "TechLibrairie Édition vous informe des étapes suivantes : mise en page, bon à tirer, publication.",
        ],
        button: {
          label: "Télécharger mon contrat",
          url: `${getEmailAppUrl()}/edition/contrat/${submissionId}`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (contrat signé, auteur) impossible :", error);
  }
}
