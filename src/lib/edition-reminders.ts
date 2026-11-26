// src/lib/edition-reminders.ts
// Relances automatiques du bon à tirer (contrat d'édition : 15 jours pour répondre à une épreuve).
// Appelée par la tâche quotidienne. Pour chaque épreuve en attente de réponse de l'auteur :
// - 10e jour : rappel à l'auteur ;
// - 14e jour : dernier rappel à l'auteur ;
// - 15e jour : alerte à l'administration (le site n'approuve jamais à la place de l'auteur).
// Chaque épreuve tombe dans une fenêtre d'un jour : elle n'est relancée qu'une fois par palier.

import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { getEmailAppUrl, isEmailConfigured, sendEmail } from "@/lib/email";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProofReminderResult {
  status: "ok" | "emails-desactives";
  authorReminders: number;
  adminAlerts: number;
}

type Step = "j10" | "j14" | "j15";

function stepFor(ageMs: number): Step | null {
  if (ageMs >= 15 * DAY_MS && ageMs < 16 * DAY_MS) return "j15";
  if (ageMs >= 14 * DAY_MS && ageMs < 15 * DAY_MS) return "j14";
  if (ageMs >= 10 * DAY_MS && ageMs < 11 * DAY_MS) return "j10";
  return null;
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

export async function sendProofReminders(options: { budgetMs?: number } = {}): Promise<ProofReminderResult> {
  const startedAt = Date.now();
  const budgetMs = options.budgetMs ?? 5000;

  if (!isEmailConfigured()) {
    return { status: "emails-desactives", authorReminders: 0, adminAlerts: 0 };
  }

  const now = Date.now();

  const projects = await prisma.editionProject.findMany({
    where: {
      stage: "PROOF_PENDING",
      proofUploadedAt: { not: null, lte: new Date(now - 10 * DAY_MS) },
    },
    select: { productId: true, sellerId: true, proofVersion: true, proofUploadedAt: true },
    take: 200,
  });

  const due = projects
    .map((project) => ({
      project,
      step: project.proofUploadedAt ? stepFor(now - project.proofUploadedAt.getTime()) : null,
    }))
    .filter(
      (item): item is { project: (typeof projects)[number]; step: Step } => item.step !== null
    );

  if (due.length === 0) {
    return { status: "ok", authorReminders: 0, adminAlerts: 0 };
  }

  const [products, sellers, admins] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: due.map((item) => item.project.productId) } },
      select: { id: true, title: true },
    }),
    prisma.sellerProfile.findMany({
      where: { id: { in: due.map((item) => item.project.sellerId) } },
      select: { id: true, displayName: true, user: { select: { email: true } } },
    }),
    adminRecipients(),
  ]);

  const titleById = new Map(products.map((product) => [product.id, product.title]));
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
  const appUrl = getEmailAppUrl();

  let authorReminders = 0;
  let adminAlerts = 0;

  for (const { project, step } of due) {
    if (Date.now() - startedAt > budgetMs) break;

    const title = titleById.get(project.productId);
    const seller = sellerById.get(project.sellerId);
    if (!title || !seller) continue;

    try {
      if (step === "j15") {
        if (admins.length === 0) continue;

        await sendEmail({
          to: admins,
          subject: `Délai de 15 jours écoulé : ${title}`,
          idempotencyKey: `proof-overdue-${project.productId}-v${project.proofVersion}`,
          content: {
            title: "Une épreuve attend la réponse de l'auteur depuis 15 jours",
            paragraphs: [
              `${seller.displayName} n'a ni approuvé ni commenté l'épreuve (version ${project.proofVersion}) de « ${title} » dans le délai de 15 jours prévu par le contrat.`,
              "Relancez l'auteur directement : le site n'approuve jamais l'épreuve à sa place.",
            ],
            button: { label: "Ouvrir les éditions", url: `${appUrl}/admin/publications?statut=bat` },
          },
        });

        adminAlerts += 1;
      } else {
        const lastCall = step === "j14";

        await sendEmail({
          to: seller.user.email,
          subject: lastCall
            ? `Dernier rappel : votre épreuve de « ${title} »`
            : `Votre épreuve de « ${title} » vous attend`,
          idempotencyKey: `proof-reminder-${project.productId}-v${project.proofVersion}-${step}`,
          content: {
            title: lastCall ? "Dernier rappel avant la fin du délai" : "Votre épreuve vous attend",
            paragraphs: [
              `L'épreuve (bon à tirer, version ${project.proofVersion}) de « ${title} » est prête depuis ${
                lastCall ? "14" : "10"
              } jours.`,
              lastCall
                ? "Le délai prévu par votre contrat pour l'approuver ou demander des corrections est de 15 jours : il se termine demain."
                : "Le délai prévu par votre contrat pour l'approuver ou demander des corrections est de 15 jours.",
              "Relisez-la depuis votre espace, puis approuvez-la ou demandez des corrections. Rien n'est publié sans votre accord.",
            ],
            button: {
              label: "Relire mon épreuve",
              url: `${appUrl}/vendeur/publication/${project.productId}`,
            },
          },
        });

        authorReminders += 1;
      }
    } catch (error) {
      console.error("Relance de bon à tirer impossible :", error);
    }
  }

  return { status: "ok", authorReminders, adminAlerts };
                      }
