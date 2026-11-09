// src/lib/publication-fee.ts
// Forfait d'édition du service « Édition de livres à compte d'auteur » : montant, numéros de réception
// et contrôles des informations de paiement saisies par l'auteur.
//
// Le forfait (25 000 FCFA par défaut) est dû pour chaque nouveau livre, aussitôt après le dépôt du PDF.
// Il rémunère les prestations d'édition décrites dans le contrat. Il est enregistré à part
// (table PublicationFee) et n'intervient dans AUCUN calcul de commission, de revenu ou de versement.

export const DEFAULT_CONTRIBUTION_XOF = 25_000;

export const CONTRIBUTION_METHODS = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MOOV_MONEY", label: "Moov Money" },
] as const;

export type ContributionMethod = (typeof CONTRIBUTION_METHODS)[number]["value"];

export function isContributionMethod(value: string): value is ContributionMethod {
  return CONTRIBUTION_METHODS.some((method) => method.value === value);
}

export interface ContributionConfig {
  amountXof: number;
  orangeNumber: string | null;
  moovNumber: string | null;
  // Vrai si au moins un numéro de réception est configuré
  paymentOpen: boolean;
}

function cleanNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return /^\+?[0-9][0-9 ]{5,19}$/.test(value) ? value : null;
}

/** Lit le montant et les numéros de réception dans les variables d'environnement de Vercel. */
export function getContributionConfig(): ContributionConfig {
  const parsed = Number.parseInt(process.env.PUBLICATION_FEE_XOF ?? "", 10);
  const amountXof =
    Number.isInteger(parsed) && parsed >= 100 && parsed <= 1_000_000 && parsed % 5 === 0
      ? parsed
      : DEFAULT_CONTRIBUTION_XOF;

  const orangeNumber = cleanNumber(process.env.PUBLICATION_FEE_ORANGE_NUMBER);
  const moovNumber = cleanNumber(process.env.PUBLICATION_FEE_MOOV_NUMBER);

  return {
    amountXof,
    orangeNumber,
    moovNumber,
    paymentOpen: orangeNumber !== null || moovNumber !== null,
  };
}

/** Référence à indiquer dans le message du transfert, pour retrouver le paiement. */
export function paymentReferenceCode(productId: string): string {
  return `TL-${productId.slice(-6).toUpperCase()}`;
}

/** Numéro de téléphone de l'expéditeur : 8 à 15 chiffres, « + » initial accepté. */
export function normalizePayerPhone(raw: string): string | null {
  const compact = raw.replace(/[\s.-]/g, "");
  return /^\+?\d{8,15}$/.test(compact) ? compact : null;
}

/** Référence de la transaction Mobile Money : 4 à 40 caractères (lettres, chiffres, point, tiret). */
export function normalizeTransactionReference(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9._-]{4,40}$/.test(value) ? value : null;
}
