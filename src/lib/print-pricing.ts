// src/lib/print-pricing.ts
// Livre imprimé à la demande : prix plancher, gain de l'auteur, état du format et libellés.
// Fichier sans dépendance serveur : utilisable côté navigateur comme côté serveur.

import type { PrintFormatStatus } from "@prisma/client";

// Marge de sécurité ajoutée au coût de fabrication pour obtenir le prix plancher (article 9 du contrat)
export const PRICE_FLOOR_MARGIN_PERCENT = 10;

export const MAX_PRINT_PRICE_XOF = 1_000_000;
export const MAX_PRINT_COST_XOF = 1_000_000;

export const PRINT_STATUS_LABELS: Record<PrintFormatStatus, string> = {
  DRAFT: "En préparation",
  READY: "Prêt : prix à fixer",
  ACTIVE: "Proposé à l'achat",
  DISABLED: "Retiré",
};

export const PRINT_STATUS_STYLES: Record<PrintFormatStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  READY: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  DISABLED: "bg-red-100 text-red-800",
};

/** Code d'impression du prestataire : 27 caractères (chiffres et lettres majuscules). */
export function isValidPodPackageId(value: string): boolean {
  return /^[0-9A-Z]{27}$/.test(value);
}

/** Prix plancher : coût de fabrication + marge de sécurité, arrondi au multiple de 5 supérieur. */
export function printPriceFloorXof(printCostXof: number): number {
  return Math.ceil((printCostXof * (100 + PRICE_FLOOR_MARGIN_PERCENT)) / 500) * 5;
}

/** Gain de l'auteur sur un exemplaire : 100 % du prix, moins le coût de fabrication. */
export function authorNetPerCopyXof(retailPriceXof: number, printCostXof: number): number {
  return Math.max(0, retailPriceXof - printCostXof);
}

export interface PrintStatusInput {
  status: PrintFormatStatus;
  podPackageId: string | null;
  interiorStorageKey: string | null;
  coverStorageKey: string | null;
  printCostXof: number | null;
  retailPriceXof: number | null;
}

/** Vrai si le format a tout ce qu'il faut pour que l'auteur fixe son prix. */
export function isPrintConfigured(input: PrintStatusInput): boolean {
  return Boolean(
    input.podPackageId &&
      input.interiorStorageKey &&
      input.coverStorageKey &&
      input.printCostXof !== null &&
      input.printCostXof > 0
  );
}

/**
 * État que doit avoir le format imprimé, selon sa configuration et le prix de l'auteur :
 * - retiré par l'administration : il le reste ;
 * - configuration incomplète : en préparation ;
 * - proposé à l'achat tant que le prix de l'auteur est au moins égal au prix plancher ;
 * - sinon prêt (prix à fixer ou à corriger : la vente est suspendue).
 */
export function resolvePrintStatus(input: PrintStatusInput): PrintFormatStatus {
  if (input.status === "DISABLED") return "DISABLED";
  if (!isPrintConfigured(input) || input.printCostXof === null) return "DRAFT";

  const priceOk =
    input.retailPriceXof !== null &&
    input.retailPriceXof >= printPriceFloorXof(input.printCostXof);

  return input.status === "ACTIVE" && priceOk ? "ACTIVE" : "READY";
}
