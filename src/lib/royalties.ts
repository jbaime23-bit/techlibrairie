// src/lib/royalties.ts
// Calcul des droits d'auteur dus sur les livres à compte d'éditeur.
// Base : prix public hors taxes de chaque exemplaire vendu et payé (livraison exclue), commandes remboursées ou
// annulées exclues, exemplaires d'auteur exclus. Arrondi à l'entier inférieur, vente par vente.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PRINT_EARNED_STATUSES, PRINT_RELEASED_STATUSES } from "@/lib/print-statuses";

type Client = Prisma.TransactionClient;

export interface RoyaltyLine {
  agreementId: string;
  productId: string;
  title: string;
  percent: number;
  digitalCopies: number;
  digitalGrossXof: number;
  digitalRoyaltyXof: number;
  printCopies: number;
  printGrossXof: number;
  printRoyaltyXof: number;
  // Droits acquis sur la période, et part déjà retirable
  earnedXof: number;
  releasedXof: number;
}

export interface RoyaltyReport {
  lines: RoyaltyLine[];
  earnedXof: number;
  releasedXof: number;
}

export interface RoyaltyQuery {
  // Limite aux accords d'un auteur (identifiant de son profil vendeur)
  authorSellerId?: string;
  // Période : début inclus, fin exclue
  from?: Date;
  to?: Date;
  // Date avant laquelle un paiement est assez ancien pour que les droits soient retirables
  releaseThreshold: Date;
}

function royaltyOf(grossXof: number, percent: number): number {
  return Math.floor((grossXof * percent) / 100);
}

export async function computeRoyalties(query: RoyaltyQuery, client: Client = prisma): Promise<RoyaltyReport> {
  const agreements = await client.royaltyAgreement.findMany({
    where: {
      active: true,
      ...(query.authorSellerId ? { authorSellerId: query.authorSellerId } : {}),
    },
    select: { id: true, productId: true, royaltyPercent: true },
  });

  if (agreements.length === 0) {
    return { lines: [], earnedXof: 0, releasedXof: 0 };
  }

  const productIds = agreements.map((agreement) => agreement.productId);
  const hasRange = Boolean(query.from || query.to);
  const range = {
    ...(query.from ? { gte: query.from } : {}),
    ...(query.to ? { lt: query.to } : {}),
  };

  const [products, items, prints] = await Promise.all([
    client.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true },
    }),
    client.orderItem.findMany({
      where: {
        productId: { in: productIds },
        currency: "XOF",
        order: { status: "PAID", ...(hasRange ? { paidAt: range } : {}) },
      },
      select: { productId: true, unitAmount: true, order: { select: { paidAt: true } } },
    }),
    client.printOrder.findMany({
      where: {
        productId: { in: productIds },
        isAuthorCopy: false,
        status: { in: PRINT_EARNED_STATUSES },
        ...(hasRange ? { paidAt: range } : {}),
      },
      select: { productId: true, unitPriceXof: true, quantity: true, status: true, paidAt: true },
    }),
  ]);

  const titleById = new Map(products.map((product) => [product.id, product.title]));
  const lineByProduct = new Map<string, RoyaltyLine>();

  for (const agreement of agreements) {
    lineByProduct.set(agreement.productId, {
      agreementId: agreement.id,
      productId: agreement.productId,
      title: titleById.get(agreement.productId) ?? "Ouvrage",
      percent: agreement.royaltyPercent,
      digitalCopies: 0,
      digitalGrossXof: 0,
      digitalRoyaltyXof: 0,
      printCopies: 0,
      printGrossXof: 0,
      printRoyaltyXof: 0,
      earnedXof: 0,
      releasedXof: 0,
    });
  }

  for (const item of items) {
    const line = lineByProduct.get(item.productId);
    if (!line) continue;

    const royalty = royaltyOf(item.unitAmount, line.percent);

    line.digitalCopies += 1;
    line.digitalGrossXof += item.unitAmount;
    line.digitalRoyaltyXof += royalty;
    line.earnedXof += royalty;

    if (item.order.paidAt && item.order.paidAt <= query.releaseThreshold) {
      line.releasedXof += royalty;
    }
  }

  for (const print of prints) {
    const line = lineByProduct.get(print.productId);
    if (!line) continue;

    const gross = print.unitPriceXof * print.quantity;
    const royalty = royaltyOf(gross, line.percent);

    line.printCopies += print.quantity;
    line.printGrossXof += gross;
    line.printRoyaltyXof += royalty;
    line.earnedXof += royalty;

    if (
      PRINT_RELEASED_STATUSES.includes(print.status) &&
      print.paidAt &&
      print.paidAt <= query.releaseThreshold
    ) {
      line.releasedXof += royalty;
    }
  }

  const lines = Array.from(lineByProduct.values()).sort((a, b) => a.title.localeCompare(b.title, "fr"));

  return {
    lines,
    earnedXof: lines.reduce((total, line) => total + line.earnedXof, 0),
    releasedXof: lines.reduce((total, line) => total + line.releasedXof, 0),
  };
}

/** Droits d'un auteur, tous livres et toutes périodes : alimente son solde de versements. */
export async function computeRoyaltyTotals(
  authorSellerId: string,
  releaseThreshold: Date,
  client: Client = prisma
): Promise<{ earned: number; released: number }> {
  const report = await computeRoyalties({ authorSellerId, releaseThreshold }, client);
  return { earned: report.earnedXof, released: report.releasedXof };
      }
