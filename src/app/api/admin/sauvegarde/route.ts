// src/app/api/admin/sauvegarde/route.ts
// Téléchargement de la sauvegarde de secours (administrateurs uniquement) :
// ?jeu=tout pour un fichier JSON complet, ou ?jeu=<nom> pour un fichier CSV d'un seul jeu de données.
// Chaque téléchargement est enregistré dans le journal et limité en fréquence.

import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/admin";
import { buildCsv, csvResponse, type Cell } from "@/lib/csv";
import {
  BACKUP_DATASETS,
  BackupTooLargeError,
  findDataset,
} from "@/lib/backup";
import { recordAdminAction } from "@/lib/audit";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Les réponses des fonctions Vercel sont limitées à environ 4,5 Mo : au-delà, mieux vaut refuser.
const MAX_JSON_BYTES = 4_000_000;

export async function GET(request: Request) {
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);

  const admin = await getAdminOrNull();
  if (!admin) {
    return redirectTo("/?erreur=acces-refuse");
  }

  const key = new URL(request.url).searchParams.get("jeu");
  const isAll = key === "tout";
  const single = isAll ? null : findDataset(key);

  if (!isAll && !single) {
    return redirectTo("/admin/sauvegarde?erreur=jeu");
  }

  // Limitation : 5 téléchargements par quart d'heure et par jeu de données.
  const ipHash = hashClientIp(request.headers.get("x-forwarded-for"));
  const throttleKey = `backup:${admin.id}:${key}`;

  if (await isLoginThrottled(throttleKey, ipHash)) {
    return redirectTo("/admin/sauvegarde?erreur=limite");
  }
  await recordLoginFailure(throttleKey, ipHash);

  const date = new Date().toISOString().slice(0, 10);

  try {
    if (single) {
      const rows = await single.rows();

      await recordAdminAction(admin, {
        action: "sauvegarde.telechargee",
        targetType: "sauvegarde",
        details: { jeu: single.key, lignes: rows.length },
      });

      return csvResponse(
        buildCsv(single.headers, rows),
        `techlibrairie-sauvegarde-${single.key}-${date}.csv`
      );
    }

    const report: Record<string, { colonnes: string[]; lignes: Cell[][] }> = {};
    let totalRows = 0;

    for (const item of BACKUP_DATASETS) {
      const rows = await item.rows();
      report[item.key] = { colonnes: item.headers, lignes: rows };
      totalRows += rows.length;
    }

    const body = JSON.stringify({
      genere_le: new Date().toISOString(),
      site: "TechLibrairie",
      avertissement:
        "Ce fichier contient des données personnelles : conservez-le en lieu sûr et ne le partagez pas. Les fichiers PDF et les images ne sont pas inclus.",
      jeux: report,
    });

    if (Buffer.byteLength(body, "utf8") > MAX_JSON_BYTES) {
      return redirectTo("/admin/sauvegarde?erreur=trop-volumineux");
    }

    await recordAdminAction(admin, {
      action: "sauvegarde.telechargee",
      targetType: "sauvegarde",
      details: { jeu: "tout", lignes: totalRows },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="techlibrairie-sauvegarde-complete-${date}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof BackupTooLargeError) {
      return redirectTo("/admin/sauvegarde?erreur=trop-de-lignes");
    }
    console.error("Sauvegarde impossible :", error);
    return redirectTo("/admin/sauvegarde?erreur=technique");
  }
}
