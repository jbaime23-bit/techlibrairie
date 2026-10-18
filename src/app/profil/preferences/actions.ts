// src/app/profil/preferences/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Active ou désactive le rappel par email d'une commande non terminée. */
export async function updateReminderPreferenceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent("/profil")}`);
  }

  const enabled = formData.get("reminders") === "on";

  await prisma.user.update({
    where: { id: user.id },
    data: { reminderEmails: enabled },
  });

  revalidatePath("/profil");
  redirect("/profil?message=preferences");
}
