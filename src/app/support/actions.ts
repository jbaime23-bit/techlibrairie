// src/app/support/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function readId(formData: FormData): string | null {
  const value = formData.get("threadId");
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/** Clôture une conversation (propriétaire ou administrateur). */
export async function closeThreadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion");
  }

  const isAdmin = user.role === "ADMIN";
  const listPath = isAdmin ? "/admin/support" : "/support";
  const threadId = readId(formData);

  if (!threadId) {
    redirect(listPath);
  }

  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true, userId: true, status: true },
  });

  if (!thread || (!isAdmin && thread.userId !== user.id)) {
    redirect(listPath);
  }

  if (thread.status !== "CLOSED") {
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }

  revalidatePath("/support");
  revalidatePath("/admin/support");
  redirect(`${listPath}/${thread.id}`);
}

/** Rouvre une conversation payée (administrateur uniquement). */
export async function reopenThreadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/?erreur=acces-refuse");
  }

  const threadId = readId(formData);
  if (!threadId) {
    redirect("/admin/support");
  }

  await prisma.supportThread.updateMany({
    where: { id: threadId, status: "CLOSED", paidAt: { not: null } },
    data: { status: "OPEN", closedAt: null, lastMessageAt: new Date() },
  });

  revalidatePath("/support");
  revalidatePath("/admin/support");
  redirect(`/admin/support/${threadId}`);
      }
