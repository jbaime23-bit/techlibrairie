// src/app/admin/emails/actions.ts
"use server";

import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";

const BACK = "/admin/emails";

/** Envoie un email de test à l'administrateur connecté, pour vérifier la configuration. */
export async function sendTestEmailAction(): Promise<void> {
  const admin = await assertAdminAction();

  if (!isEmailConfigured()) {
    redirect(`${BACK}?erreur=non-configure`);
  }

  const result = await sendEmail({
    to: admin.email,
    subject: "Test d'envoi TechLibrairie",
    content: {
      title: "Email de test",
      paragraphs: [
        "Si vous lisez ce message, l'envoi d'emails de TechLibrairie fonctionne correctement.",
      ],
    },
  });

  if (!result.ok) {
    redirect(`${BACK}?erreur=envoi&detail=${encodeURIComponent(result.error.slice(0, 200))}`);
  }

  redirect(`${BACK}?message=envoye`);
}
