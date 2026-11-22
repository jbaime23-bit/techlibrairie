// src/app/edition/contrat/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashClientIp } from "@/lib/login-throttle";
import {
  notifyAdminsPublisherContractSigned,
  notifyAuthorPublisherContractSigned,
} from "@/lib/manuscript-notifications";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** L'auteur d'un manuscrit retenu signe en ligne son contrat d'édition à compte d'éditeur. */
export async function signPublisherContractAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/edition/connexion");
  }

  const submissionId = readText(formData, "submissionId", 40);
  if (!/^[a-z0-9]{1,40}$/i.test(submissionId)) {
    redirect("/edition/espace");
  }

  const back = `/edition/contrat/${submissionId}`;

  const contract = await prisma.publisherContract.findFirst({
    where: { submissionId, userId: user.id },
    select: { id: true, acceptedAt: true },
  });

  if (!contract) {
    redirect("/edition/espace");
  }
  if (contract.acceptedAt) {
    redirect(`${back}?erreur=etat`);
  }

  if (formData.get("confirm") !== "oui") {
    redirect(`${back}?erreur=confirmation`);
  }

  const signature = readText(formData, "signature", 120);
  if (signature.length < 3) {
    redirect(`${back}?erreur=signature`);
  }

  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));

  const claimed = await prisma.publisherContract.updateMany({
    where: { id: contract.id, acceptedAt: null },
    data: {
      acceptedAt: new Date(),
      signerName: signature,
      signerEmail: user.email,
      signerIpHash: ipHash,
    },
  });

  if (claimed.count === 0) {
    redirect(`${back}?erreur=etat`);
  }

  await notifyAuthorPublisherContractSigned(submissionId);
  await notifyAdminsPublisherContractSigned(submissionId);

  revalidatePath(back);
  revalidatePath("/edition/espace");
  revalidatePath("/admin/manuscrits");
  redirect(`${back}?message=signe`);
}
