// src/lib/publishing-models.ts
// Formules d'édition proposées aux auteurs. Fichier autonome : il ne modifie rien et n'est pas encore
// branché sur le site.
//
// - Modèle A (compte d'auteur, participatif) : participation à l'entrée, gains conservés à 100 %,
//   0 % de commission pour TechLibrairie. L'auteur supporte les coûts de production d'un livre imprimé.
// - Modèle B (compte d'éditeur, commercial) : gratuit à l'entrée, redevance fixe pour l'auteur ;
//   TechLibrairie conserve le reste et supporte les coûts de production.
//
// Les montants se règlent par variables Vercel (facultatives) :
//   PUBLISHING_MODEL_A_FEE_XOF            (défaut 25000, multiple de 5)
//   PUBLISHING_MODEL_B_AUTHOR_SHARE_BPS   (défaut 1200 = 12 %, entre 100 et 9900)

export const PUBLISHING_MODEL_VALUES = ["AUTHOR_ACCOUNT", "PUBLISHER_ACCOUNT"] as const;

export type PublishingModelValue = (typeof PUBLISHING_MODEL_VALUES)[number];

// Qui supporte le coût d'impression et de livraison d'un livre imprimé à la demande
export type CostBearer = "AUTHOR" | "PUBLISHER";

export interface PublishingModelTerms {
  value: PublishingModelValue;
  letter: "A" | "B";
  label: string;
  summary: string;
  // Paiement unique demandé à l'entrée (FCFA)
  entryFeeXof: number;
  // Part de l'auteur sur chaque vente, en points de base (10000 = 100 %)
  authorShareBps: number;
  // Part conservée par TechLibrairie, en points de base
  platformShareBps: number;
  costBearer: CostBearer;
}

const BPS_DENOMINATOR = 10_000;
const DEFAULT_MODEL_A_FEE_XOF = 25_000;
const DEFAULT_MODEL_B_AUTHOR_SHARE_BPS = 1_200;

function readEntryFeeXof(): number {
  const parsed = Number.parseInt(process.env.PUBLISHING_MODEL_A_FEE_XOF ?? "", 10);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1_000_000 && parsed % 5 === 0
    ? parsed
    : DEFAULT_MODEL_A_FEE_XOF;
}

function readAuthorShareBps(): number {
  const parsed = Number.parseInt(process.env.PUBLISHING_MODEL_B_AUTHOR_SHARE_BPS ?? "", 10);

  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 9_900
    ? parsed
    : DEFAULT_MODEL_B_AUTHOR_SHARE_BPS;
}

export function isPublishingModel(value: string): value is PublishingModelValue {
  return PUBLISHING_MODEL_VALUES.some((model) => model === value);
}

/** Les deux formules, avec leurs montants actuels (lecture serveur : ne pas appeler dans un composant client). */
export function getPublishingModels(): PublishingModelTerms[] {
  const authorShareBps = readAuthorShareBps();

  return [
    {
      value: "AUTHOR_ACCOUNT",
      letter: "A",
      label: "Compte d'auteur (participatif)",
      summary:
        "Vous participez au financement de l'édition de votre livre et vous conservez l'intégralité de vos gains sur les ventes.",
      entryFeeXof: readEntryFeeXof(),
      authorShareBps: BPS_DENOMINATOR,
      platformShareBps: 0,
      costBearer: "AUTHOR",
    },
    {
      value: "PUBLISHER_ACCOUNT",
      letter: "B",
      label: "Compte d'éditeur (commercial)",
      summary:
        "TechLibrairie étudie votre livre, l'édite à ses frais s'il est retenu, et vous reverse une redevance fixe sur chaque vente.",
      entryFeeXof: 0,
      authorShareBps,
      platformShareBps: BPS_DENOMINATOR - authorShareBps,
      costBearer: "PUBLISHER",
    },
  ];
}

export function getPublishingModel(value: PublishingModelValue): PublishingModelTerms {
  const found = getPublishingModels().find((model) => model.value === value);

  if (!found) {
    throw new Error(`Formule d'édition inconnue : ${value}`);
  }

  return found;
}

/**
 * Commission de TechLibrairie en points de base pour une formule : c'est la valeur à enregistrer dans
 * SellerProfile.commissionRateBps de l'auteur (0 pour le modèle A).
 */
export function platformCommissionBps(model: PublishingModelValue): number {
  return getPublishingModel(model).platformShareBps;
}

export interface SaleSplit {
  priceXof: number;
  // Montant dû à l'auteur
  authorXof: number;
  // Montant conservé par TechLibrairie (authorXof + platformXof = priceXof)
  platformXof: number;
  // Coût d'impression et de livraison d'un livre imprimé (0 pour un PDF)
  productionCostXof: number;
  // Ce qui reste à TechLibrairie après avoir réglé le coût de production (peut être négatif au modèle B
  // si le prix de vente est trop bas : à surveiller)
  platformMarginXof: number;
}

function toAmount(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} invalide : ${value}`);
  }
  return Math.round(value);
}

/**
 * Partage d'une vente entre l'auteur et TechLibrairie.
 * - Modèle A : le coût de production est déduit, puis l'auteur reçoit 100 % du reste ; TechLibrairie ne
 *   garde que le remboursement de ce coût.
 * - Modèle B : l'auteur reçoit sa redevance sur le prix de vente ; TechLibrairie garde le reste et supporte
 *   le coût de production.
 * Les montants sont des francs entiers ; l'arrondi joue toujours en faveur de TechLibrairie.
 */
export function splitSale(params: {
  model: PublishingModelValue;
  priceXof: number;
  productionCostXof?: number;
}): SaleSplit {
  const price = toAmount(params.priceXof, "Prix");
  const cost = Math.min(price, toAmount(params.productionCostXof ?? 0, "Coût de production"));
  const terms = getPublishingModel(params.model);

  const base = terms.costBearer === "AUTHOR" ? price - cost : price;
  const authorXof = Math.floor((base * terms.authorShareBps) / BPS_DENOMINATOR);
  const platformXof = price - authorXof;

  return {
    priceXof: price,
    authorXof,
    platformXof,
    productionCostXof: cost,
    platformMarginXof: platformXof - cost,
  };
}
