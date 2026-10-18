// src/app/api/cron/rappels/route.ts
// Appelée chaque jour par la tâche planifiée de Vercel (voir vercel.json).
// Protégée par CRON_SECRET : Vercel envoie automatiquement ce secret dans l'en-tête Authorization.

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sendAbandonedOrderReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

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

  const report = await sendAbandonedOrderReminders();

  console.log("Rappels de commandes terminés :", JSON.stringify(report));

  return NextResponse.json(report);
    }
