// src/app/admin/alertes/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { getEmailAppUrl, isEmailConfigured } from "@/lib/email";
import { computeAdminAlerts, sendAlertsEmail } from "@/lib/admin-alerts";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

const BACK = "/admin/alertes";

/** Envoie la liste des alertes en cours par email à l'administrateur connecté (à lui seul). */
export async function emailAlertsAction(): Promise<void> {
  const admin = await assertAdminAction();

  if (!isEmailConfigured() || !getEmailAppUrl()) {
    redirect(`${BACK}?erreur=email`);
  }

  // Limitation : 5 envois par 15 minutes.
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));
  const throttleKey = `alerts:${admin.id}`;

  if (await isLoginThrottled(throttleKey, ipHash)) {
    redirect(`${BACK}?erreur=limite`);
  }
  await recordLoginFailure(throttleKey, ipHash);

  const alerts = await computeAdminAlerts();

  if (alerts.length === 0) {
    redirect(`${BACK}?message=aucune`);
  }

  const result = await sendAlertsEmail(
    alerts,
    admin.email,
    `admin-alerts-manual-${admin.id}-${Date.now()}`
  );

  if (!result.ok) {
    redirect(`${BACK}?erreur=envoi`);
  }

  await recordAdminAction(admin, {
    action: "alerte.envoyee_manuel",
    targetType: "alerte",
    details: { nombre: alerts.length },
  });

  redirect(`${BACK}?message=envoye`);
}
