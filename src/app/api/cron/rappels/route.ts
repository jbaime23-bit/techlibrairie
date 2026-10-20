// src/app/api/cron/rappels/route.ts
// Appelée chaque jour par la tâche planifiée de Vercel (voir vercel.json) :
// - rappel des commandes non terminées ;
// - envoi du rapport mensuel aux administrateurs, une fois par mois (sans effet les autres jours) ;
// - envoi des alertes aux administrateurs, s'il y en a (au plus un email par jour).
// Chaque traitement est indépendant : la panne de l'un n'empêche pas les autres.
// Protégée par CRON_SECRET : Vercel envoie automatiquement ce secret dans l'en-tête Authorization.

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sendAbandonedOrderReminders } from "@/lib/reminders";
import { sendMonthlyReportIfDue } from "@/lib/monthly-report";
import { sendAdminAlertsIfDue } from "@/lib/admin-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Fonction désactivée." }, { status: 404 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!secretsMatch(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  let reminders: unknown;
  try {
    reminders = await sendAbandonedOrderReminders({ budgetMs: 5000 });
  } catch (error) {
    console.error("Rappels de commandes : échec :", error);
    reminders = { erreur: "echec" };
  }

  let monthlyReport: unknown;
  try {
    monthlyReport = await sendMonthlyReportIfDue();
  } catch (error) {
    console.error("Rapport mensuel : échec :", error);
    monthlyReport = { status: "echec" };
  }

  let alerts: unknown;
  try {
    alerts = await sendAdminAlertsIfDue();
  } catch (error) {
    console.error("Alertes d'administration : échec :", error);
    alerts = { status: "echec" };
  }

  console.log(
    "Tâche quotidienne terminée :",
    JSON.stringify({ reminders, monthlyReport, alerts })
  );

  return NextResponse.json({ reminders, monthlyReport, alerts });
}
