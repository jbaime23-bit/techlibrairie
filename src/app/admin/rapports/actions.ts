// src/app/admin/rapports/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { getEmailAppUrl, isEmailConfigured } from "@/lib/email";
import {
  buildMonthlyReport,
  parseMonthKey,
  sendReportEmail,
} from "@/lib/monthly-report";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

/** Envoie le rapport d'un mois par email à l'administrateur connecté (à lui seul). */
export async function emailReportAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const rawMonth = formData.get("mois");
  const month = parseMonthKey(typeof rawMonth === "string" ? rawMonth : undefined);

  if (!month) {
    redirect("/admin/rapports?erreur=mois");
  }

  const back = `/admin/rapports?mois=${month.key}`;

  if (!isEmailConfigured() || !getEmailAppUrl()) {
    redirect(`${back}&erreur=email`);
  }

  // Limitation : 5 envois par 15 minutes.
  const ipHash = hashClientIp((await headers()).get("x-forwarded-for"));
  const throttleKey = `report:${admin.id}`;

  if (await isLoginThrottled(throttleKey, ipHash)) {
    redirect(`${back}&erreur=limite`);
  }
  await recordLoginFailure(throttleKey, ipHash);

  const report = await buildMonthlyReport(month);

  const result = await sendReportEmail(
    report,
    admin.email,
    `monthly-report-manual-${month.key}-${admin.id}-${Date.now()}`
  );

  if (!result.ok) {
    redirect(`${back}&erreur=envoi`);
  }

  await recordAdminAction(admin, {
    action: "rapport.envoye_manuel",
    targetType: "rapport",
    targetId: month.key,
  });

  redirect(`${back}&message=envoye`);
}
