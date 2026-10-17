// src/app/api/vendeur/export/route.ts
// Export comptable (CSV) d'un vendeur : uniquement SES ventes et SES versements.

import { NextResponse } from "next/server";
import { getSellerContext } from "@/lib/seller";
import { buildCsv, csvResponse, parseDateRange } from "@/lib/csv";
import {
  ExportTooLargeError,
  buildSellerReport,
  isSellerReport,
} from "@/lib/accounting-export";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);

  const context = await getSellerContext();
  if (context.status === "unauthenticated") {
    return redirectTo(`/connexion?callbackUrl=${encodeURIComponent("/vendeur/export")}`);
  }
  if (context.status !== "ok") {
    return redirectTo("/vendeur/export?erreur=compte");
  }

  const params = new URL(request.url).searchParams;
  const type = params.get("type");

  if (!isSellerReport(type)) {
    return redirectTo("/vendeur/export?erreur=type");
  }

  const parsed = parseDateRange(params.get("from"), params.get("to"));
  if (!parsed.ok) {
    return redirectTo(`/vendeur/export?erreur=${parsed.error}`);
  }

  // Limitation de la fréquence des exports.
  const ipHash = hashClientIp(request.headers.get("x-forwarded-for"));
  const throttleKey = `exportcsv:${context.user.id}`;

  if (await isLoginThrottled(throttleKey, ipHash)) {
    return redirectTo("/vendeur/export?erreur=limite");
  }
  await recordLoginFailure(throttleKey, ipHash);

  const { range } = parsed;

  let table;
  try {
    table = await buildSellerReport(type, range, context.seller.id);
  } catch (error) {
    if (error instanceof ExportTooLargeError) {
      return redirectTo("/vendeur/export?erreur=trop-de-lignes");
    }
    console.error("Export comptable vendeur impossible :", error);
    return redirectTo("/vendeur/export?erreur=technique");
  }

  return csvResponse(
    buildCsv(table.headers, table.rows),
    `techlibrairie-mes-${table.name}-${range.from}_${range.to}.csv`
  );
}
