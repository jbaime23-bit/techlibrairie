// src/app/admin/manuscrits/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
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

/** Retient ou refuse un manuscrit, avec un message transmis à l'auteur. */
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

  const submission = await prisma.manuscriptSubmission.findUnique({
    where: { id: submissionId },
    select: { title: true },
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

  await recordAdminAction(admin, {
    action: decision === "accept" ? "manuscrit.retenu" : "manuscrit.refuse",
    targetType: "manuscrit",
    targetId: submissionId,
    details: { titre: submission.title, message: message.slice(0, 200) },
  });

  await notifyAuthorManuscriptDecision(submissionId);

  refresh();
  redirect(`${BACK}?statut=${decision === "accept" ? "retenus" : "refuses"}&message=${decision === "accept" ? "retenu" : "refuse"}`);
    }
