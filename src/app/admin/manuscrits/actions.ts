// src/app/admin/manuscrits/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { contractToPlainText, hashText } from "@/lib/edition-contract";
import { getEditionOffers } from "@/lib/edition-offers";
import { PUBLISHER_CONTRACT_VERSION, buildPublisherContract } from "@/lib/publisher-contract";
import { notifyAuthorManuscriptDecision } from "@/lib/manuscript-notifications";

const BACK = "/admin/manuscrits";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readId(formData: FormData): string | null {
  const value = readText(formData, "submissionId", 40);
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

function refresh(): void {
  revalidatePath(BACK);
  revalidatePath("/edition/espace");
}

/** Met un manuscrit reçu en cours d'examen. */
export async function startManuscriptReviewAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const submissionId = readId(formData);
  if (!submissionId) {
    redirect(BACK);
  }

  const submission = await prisma.manuscriptSubmission.findUnique({
    where: { id: submissionId },
    select: { title: true },
  });
  if (!submission) {
    redirect(BACK);
  }

  const claimed = await prisma.manuscriptSubmission.updateMany({
    where: { id: submissionId, status: "SUBMITTED" },
    data: { status: "IN_REVIEW" },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  await recordAdminAction(admin, {
    action: "manuscrit.en_examen",
    targetType: "manuscrit",
    targetId: submissionId,
    details: { titre: submission.title },
  });

  refresh();
  redirect(`${BACK}?statut=examen&message=examen`);
}

/**
 * Retient ou refuse un manuscrit, avec un message transmis à l'auteur.
 * Un manuscrit retenu reçoit aussitôt son contrat d'édition à compte d'éditeur, à signer en ligne.
 */
export async function decideManuscriptAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const submissionId = readId(formData);
  if (!submissionId) {
    redirect(BACK);
  }

  const decision = readText(formData, "decision", 10);
  if (decision !== "accept" && decision !== "reject") {
    redirect(BACK);
  }

  const message = readText(formData, "message", 1500);
  if (decision === "reject" && message.length < 10) {
    redirect(`${BACK}?erreur=motif`);
  }

  // Redevance de l'auteur (pourcentage du prix public hors taxes) : celle saisie, à défaut la valeur par défaut.
  const defaultPercent = getEditionOffers().publisherRoyaltyPercent;
  const parsedPercent = Number.parseInt(readText(formData, "royaltyPercent", 3), 10);
  const royaltyPercent =
    Number.isInteger(parsedPercent) && parsedPercent >= 1 && parsedPercent <= 60
      ? parsedPercent
      : defaultPercent;

  const submission = await prisma.manuscriptSubmission.findUnique({
    where: { id: submissionId },
    select: { title: true, authorName: true, sellerId: true, userId: true },
  });
  if (!submission) {
    redirect(BACK);
  }

  const status = decision === "accept" ? "ACCEPTED" : "REJECTED";

  const claimed = await prisma.manuscriptSubmission.updateMany({
    where: { id: submissionId, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
    data: {
      status,
      decisionMessage: message === "" ? null : message,
      decidedAt: new Date(),
      decidedBy: admin.email,
    },
  });

  if (claimed.count === 0) {
    redirect(`${BACK}?erreur=etat`);
  }

  if (decision === "accept") {
    const text = contractToPlainText(
      buildPublisherContract({
        workTitle: submission.title,
        authorName: submission.authorName,
        royaltyPercent,
      })
    );

    try {
      // Idempotent : un contrat déjà proposé (ou signé) n'est jamais écrasé.
      await prisma.publisherContract.upsert({
        where: { submissionId },
        create: {
          submissionId,
          sellerId: submission.sellerId,
          userId: submission.userId,
          version: PUBLISHER_CONTRACT_VERSION,
          workTitle: submission.title,
          royaltyPercent,
          text,
          hash: hashText(text),
        },
        update: {},
      });
    } catch (error) {
      console.error("Création du contrat d'édition à compte d'éditeur impossible :", error);
    }
  }

  await recordAdminAction(admin, {
    action: decision === "accept" ? "manuscrit.retenu" : "manuscrit.refuse",
    targetType: "manuscrit",
    targetId: submissionId,
    details: {
      titre: submission.title,
      message: message.slice(0, 200),
      ...(decision === "accept" ? { redevance_pour_cent: royaltyPercent } : {}),
    },
  });

  await notifyAuthorManuscriptDecision(submissionId);

  refresh();
  redirect(
    `${BACK}?statut=${decision === "accept" ? "retenus" : "refuses"}&message=${decision === "accept" ? "retenu" : "refuse"}`
  );
}
