// src/app/api/droits/releve/[annee]/route.ts
// Relevé annuel des droits d'auteur en PDF : pour l'auteur connecté (ses accords), ou pour un administrateur
// avec ?auteur=<identifiant du profil vendeur>.

import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { getSellerContext } from "@/lib/seller";
import { PAYOUT_HOLD_DAYS } from "@/lib/payouts";
import { computeRoyalties } from "@/lib/royalties";
import { renderRoyaltyStatementPdf } from "@/lib/royalty-statement-pdf";
import { slugify } from "@/lib/assembly/text-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function frenchDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ annee: string }> }
) {
  const { annee } = await params;
  const year = Number.parseInt(annee, 10);
  const now = new Date();

  if (!/^\d{4}$/.test(annee) || year < 2024 || year > now.getUTCFullYear()) {
    return new Response("Année invalide", { status: 400 });
  }

  const admin = await getAdminOrNull();
  const requested = new URL(request.url).searchParams.get("auteur");
  let sellerId: string;

  if (admin && requested && /^[a-z0-9]{1,40}$/i.test(requested)) {
    sellerId = requested;
  } else {
    const context = await getSellerContext();

    if (context.status !== "ok") {
      return new Response("Accès refusé", { status: 403 });
    }

    sellerId = context.seller.id;
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { displayName: true },
  });

  if (!seller) {
    return new Response("Introuvable", { status: 404 });
  }

  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const threshold = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);

  const report = await computeRoyalties({ authorSellerId: sellerId, from, to, releaseThreshold: threshold });

  const isCurrentYear = year === now.getUTCFullYear();
  const periodLabel = isCurrentYear
    ? `du 1er janvier au ${frenchDate(now)} ${year} (état provisoire)`
    : `année ${year} (arrêtée au 31 décembre ${year})`;

  const pdf = renderRoyaltyStatementPdf({
    reference: `DA-${year}-${sellerId.slice(-6).toUpperCase()}`,
    authorName: seller.displayName,
    periodLabel,
    generatedOn: frenchDate(now),
    lines: report.lines,
    totalXof: report.earnedXof,
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="releve-droits-${year}-${slugify(seller.displayName) || "auteur"}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
      }
