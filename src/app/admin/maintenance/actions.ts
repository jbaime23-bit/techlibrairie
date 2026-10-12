// src/app/admin/maintenance/actions.ts
"use server";

import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/admin";
import { runMaintenance } from "@/lib/maintenance";

const BACK = "/admin/maintenance";

/**
 * Lance la maintenance à la demande.
 * - mode "blanc" : analyse sans rien modifier ni supprimer ;
 * - mode "run" : nettoyage réel (confirmation exigée).
 */
export async function runMaintenanceAction(formData: FormData): Promise<void> {
  await assertAdminAction();

  const dryRun = formData.get("mode") !== "run";

  if (!dryRun && formData.get("confirm") !== "oui") {
    redirect(`${BACK}?erreur=confirmation`);
  }

  const report = await runMaintenance({ dryRun });

  const params = new URLSearchParams({
    mode: dryRun ? "blanc" : "reel",
    oc: String(report.abandonedOrdersCanceled),
    or: String(report.abandonedOrdersRecovered),
    st: String(report.unpaidSupportThreadsDeleted),
    tk: String(report.expiredTokensDeleted),
    la: String(report.oldLoginAttemptsDeleted),
    dt: String(report.oldDownloadTokensDeleted),
    of: String(report.orphanPdfsFound),
    od: String(report.orphanPdfsDeleted),
    sc: report.orphanScan,
    ex: report.timeBudgetExceeded ? "1" : "0",
    ms: String(report.durationMs),
  });

  redirect(`${BACK}?${params.toString()}`);
    }
