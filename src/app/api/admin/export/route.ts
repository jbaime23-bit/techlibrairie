// src/app/api/admin/export/route.ts
// Export comptable (CSV) réservé aux administrateurs.
// Chaque export est enregistré dans le journal.

import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/admin";
import { buildCsv, csvResponse, parseDateRange } from "@/lib/csv";
import {
  ExportTooLargeError,
  buildAdminReport,
  isAdminReport,
} from "@/lib/accounting-export";
import { recordAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);

  const admin = await getAdminOrNull();
  if (!admin) {
    return redirectTo("/?erreur=acces-refuse");
  }

  const params = new URL(request.url).searchParams;
  const type = params.get("type");

  if (!isAdminReport(type)) {
    return redirectTo("/admin/export?erreur=type");
  }

  const parsed = parseDateRange(params.get("from"), params.get("to"));
  if (!parsed.ok) {
    return redirectTo(`/admin/export?erreur=${parsed.error}`);
  }

  const { range } = parsed;

  let table;
  try {
    table = await buildAdminReport(type, range);
  } catch (error) {
    if (error instanceof ExportTooLargeError) {
      return redirectTo("/admin/export?erreur=trop-de-lignes");
    }
    console.error("Export comptable impossible :", error);
    return redirectTo("/admin/export?erreur=technique");
  }

  await recordAdminAction(admin, {
    action: "export.comptable",
    targetType: "export",
    details: { rapport: type, du: range.from, au: range.to, lignes: table.rows.length },
  });

  return csvResponse(
    buildCsv(table.headers, table.rows),
    `techlibrairie-${table.name}-${range.from}_${range.to}.csv`
  );
}
