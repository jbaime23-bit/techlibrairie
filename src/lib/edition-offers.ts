// src/lib/edition-offers.ts
// Les deux formules d'édition : montants affichés sur le site.
// - Édition à compte d'auteur : forfait par livre (PUBLICATION_FEE_XOF, 25 000 FCFA par défaut).
// - Édition à compte d'éditeur : redevance indicative (PUBLISHER_ROYALTY_PERCENT, 12 % par défaut),
//   fixée définitivement dans le contrat d'édition proposé à l'auteur dont le manuscrit est retenu.

import { INCLUDED_CORRECTION_ROUNDS } from "@/lib/edition-labels";
import { getContributionConfig } from "@/lib/publication-fee";

const DEFAULT_PUBLISHER_ROYALTY_PERCENT = 12;

export interface EditionOffers {
  authorFeeXof: number;
  publisherRoyaltyPercent: number;
  correctionRounds: number;
}

export function getEditionOffers(): EditionOffers {
  const parsed = Number.parseInt(process.env.PUBLISHER_ROYALTY_PERCENT ?? "", 10);
  const royalty =
    Number.isInteger(parsed) && parsed >= 1 && parsed <= 60
      ? parsed
      : DEFAULT_PUBLISHER_ROYALTY_PERCENT;

  return {
    authorFeeXof: getContributionConfig().amountXof,
    publisherRoyaltyPercent: royalty,
    correctionRounds: INCLUDED_CORRECTION_ROUNDS,
  };
}

export function formatXofAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}
