// src/lib/manuscript-notifications.ts
// Emails de l'examen éditorial. Chaque fonction relit les données, ne lève jamais d'exception et ne
// bloque jamais l'opération appelante. Sans envoi d'emails configuré, elle ne fait rien.

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

/** La décision de l'équipe éditoriale est communiquée à l'auteur. */
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
            ? "Nous vous contactons très prochainement pour vous proposer un contrat d'édition."
            : "Vous pouvez, si vous le souhaitez, faire éditer ce livre à compte d'auteur : vous gardez alors vos droits et tous vos gains.",
        ],
        button: {
          label: "Ouvrir mon espace auteur",
          url: `${getEmailAppUrl()}/edition/espace`,
        },
      },
    });
  } catch (error) {
    console.error("Notification (décision sur un manuscrit) impossible :", error);
  }
}
