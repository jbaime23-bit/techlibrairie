// src/lib/print-shipping.ts
// Livraison des livres imprimés à la demande : pays desservis, zones, tarifs fixes réglés dans Vercel,
// totaux d'une commande et libellés de statut.

import type { PrintOrderStatus } from "@prisma/client";

export type ShippingZone = "BF" | "AFRICA" | "EUROPE" | "WORLD";

export interface PrintCountry {
  code: string;
  name: string;
  zone: ShippingZone;
}

export const MAX_COPIES_PER_ORDER = 10;

// Pays pour lesquels un État ou une province est obligatoire (exigence du transporteur)
export const STATE_REQUIRED_COUNTRIES = ["US", "CA", "AU"];

export const ZONE_LABELS: Record<ShippingZone, string> = {
  BF: "Burkina Faso",
  AFRICA: "Autres pays d'Afrique",
  EUROPE: "Europe",
  WORLD: "Reste du monde",
};

const ZONE_TARIFF_VARIABLES: Record<ShippingZone, string> = {
  BF: "PRINT_SHIPPING_BF_XOF",
  AFRICA: "PRINT_SHIPPING_AFRICA_XOF",
  EUROPE: "PRINT_SHIPPING_EUROPE_XOF",
  WORLD: "PRINT_SHIPPING_WORLD_XOF",
};

function list(zone: ShippingZone, entries: [string, string][]): PrintCountry[] {
  return entries.map(([code, name]) => ({ code, name, zone }));
}

// Liste de départ : à restreindre avec PRINT_ALLOWED_COUNTRIES selon les pays réellement desservis.
export const PRINT_COUNTRIES: PrintCountry[] = [
  ...list("BF", [["BF", "Burkina Faso"]]),
  ...list("AFRICA", [
    ["DZ", "Algérie"], ["AO", "Angola"], ["BJ", "Bénin"], ["BW", "Botswana"], ["BI", "Burundi"],
    ["CM", "Cameroun"], ["CV", "Cap-Vert"], ["CF", "Centrafrique"], ["TD", "Tchad"], ["KM", "Comores"],
    ["CG", "Congo"], ["CD", "RD Congo"], ["CI", "Côte d'Ivoire"], ["DJ", "Djibouti"], ["EG", "Égypte"],
    ["GA", "Gabon"], ["GM", "Gambie"], ["GH", "Ghana"], ["GN", "Guinée"], ["GW", "Guinée-Bissau"],
    ["GQ", "Guinée équatoriale"], ["ET", "Éthiopie"], ["KE", "Kenya"], ["LR", "Libéria"],
    ["MG", "Madagascar"], ["ML", "Mali"], ["MR", "Mauritanie"], ["MU", "Maurice"], ["MA", "Maroc"],
    ["MZ", "Mozambique"], ["NE", "Niger"], ["NG", "Nigéria"], ["RW", "Rwanda"], ["SN", "Sénégal"],
    ["SL", "Sierra Leone"], ["ZA", "Afrique du Sud"], ["TZ", "Tanzanie"], ["TG", "Togo"],
    ["TN", "Tunisie"], ["UG", "Ouganda"], ["ZM", "Zambie"], ["ZW", "Zimbabwe"],
  ]),
  ...list("EUROPE", [
    ["FR", "France"], ["BE", "Belgique"], ["CH", "Suisse"], ["LU", "Luxembourg"], ["DE", "Allemagne"],
    ["IT", "Italie"], ["ES", "Espagne"], ["PT", "Portugal"], ["NL", "Pays-Bas"], ["GB", "Royaume-Uni"],
    ["IE", "Irlande"], ["AT", "Autriche"], ["SE", "Suède"], ["NO", "Norvège"], ["DK", "Danemark"],
    ["FI", "Finlande"], ["IS", "Islande"], ["PL", "Pologne"], ["CZ", "Tchéquie"], ["SK", "Slovaquie"],
    ["HU", "Hongrie"], ["RO", "Roumanie"], ["BG", "Bulgarie"], ["GR", "Grèce"], ["HR", "Croatie"],
    ["SI", "Slovénie"], ["LT", "Lituanie"], ["LV", "Lettonie"], ["EE", "Estonie"], ["MT", "Malte"],
    ["CY", "Chypre"],
  ]),
  ...list("WORLD", [
    ["US", "États-Unis"], ["CA", "Canada"], ["AU", "Australie"], ["NZ", "Nouvelle-Zélande"],
    ["JP", "Japon"], ["KR", "Corée du Sud"], ["SG", "Singapour"], ["AE", "Émirats arabes unis"],
    ["SA", "Arabie saoudite"], ["QA", "Qatar"], ["LB", "Liban"], ["IL", "Israël"], ["TR", "Turquie"],
    ["IN", "Inde"], ["BR", "Brésil"], ["MX", "Mexique"], ["AR", "Argentine"], ["CL", "Chili"],
    ["CO", "Colombie"], ["HT", "Haïti"],
  ]),
];

function readTariff(variable: string): number | null {
  const parsed = Number.parseInt(process.env[variable] ?? "", 10);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 500_000 && parsed % 5 === 0
    ? parsed
    : null;
}

/** Tarif de livraison par exemplaire pour chaque zone (null : zone fermée, tarif non réglé). */
export function getShippingTariffs(): Record<ShippingZone, number | null> {
  return {
    BF: readTariff(ZONE_TARIFF_VARIABLES.BF),
    AFRICA: readTariff(ZONE_TARIFF_VARIABLES.AFRICA),
    EUROPE: readTariff(ZONE_TARIFF_VARIABLES.EUROPE),
    WORLD: readTariff(ZONE_TARIFF_VARIABLES.WORLD),
  };
}

function readAllowlist(): Set<string> | null {
  const raw = process.env.PRINT_ALLOWED_COUNTRIES?.trim();
  if (!raw) return null;

  const codes = raw
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));

  return codes.length > 0 ? new Set(codes) : null;
}

/** Pays proposés à la commande : zone ouverte (tarif réglé) et, si définie, liste PRINT_ALLOWED_COUNTRIES. */
export function allowedCountries(): PrintCountry[] {
  const tariffs = getShippingTariffs();
  const allowlist = readAllowlist();

  return PRINT_COUNTRIES.filter(
    (country) => tariffs[country.zone] !== null && (!allowlist || allowlist.has(country.code))
  );
}

/** Pays desservi (zone ouverte et autorisé), ou null. */
export function findAllowedCountry(code: string): PrintCountry | null {
  return allowedCountries().find((country) => country.code === code.toUpperCase()) ?? null;
}

export interface PrintTotals {
  unitPriceXof: number;
  shippingXof: number;
  totalXof: number;
  authorNetXof: number;
}

/**
 * Totaux d'une commande. Pour les exemplaires de l'auteur, le prix unitaire est le coût de fabrication
 * et l'auteur ne gagne rien. La livraison est le tarif de la zone par exemplaire.
 */
export function computePrintTotals(params: {
  retailXof: number;
  printCostXof: number;
  quantity: number;
  shippingPerCopyXof: number;
  authorCopy: boolean;
}): PrintTotals {
  const unitPriceXof = params.authorCopy ? params.printCostXof : params.retailXof;
  const shippingXof = params.shippingPerCopyXof * params.quantity;

  return {
    unitPriceXof,
    shippingXof,
    totalXof: unitPriceXof * params.quantity + shippingXof,
    authorNetXof: params.authorCopy
      ? 0
      : Math.max(0, params.retailXof - params.printCostXof) * params.quantity,
  };
}

export const PRINT_ORDER_STATUS_LABELS: Record<PrintOrderStatus, string> = {
  AWAITING_PAYMENT: "En attente du paiement",
  PAYMENT_SUBMITTED: "Paiement à vérifier",
  PAID: "Payée : envoi à effectuer",
  SENDING: "Envoi en cours",
  SENT_TO_LULU: "Transmise à Lulu",
  LOCAL_PENDING: "À traiter localement",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  ERROR: "Envoi en erreur",
  CANCELED: "Annulée",
};

export const PRINT_ORDER_STATUS_STYLES: Record<PrintOrderStatus, string> = {
  AWAITING_PAYMENT: "bg-slate-100 text-slate-700",
  PAYMENT_SUBMITTED: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  SENDING: "bg-blue-100 text-blue-800",
  SENT_TO_LULU: "bg-purple-100 text-purple-800",
  LOCAL_PENDING: "bg-orange-100 text-orange-800",
  SHIPPED: "bg-green-100 text-green-800",
  DELIVERED: "bg-green-100 text-green-800",
  ERROR: "bg-red-100 text-red-800",
  CANCELED: "bg-red-100 text-red-800",
};

// Ce que voit l'acheteur : les erreurs techniques d'envoi ne lui sont jamais montrées.
export const BUYER_STATUS_LABELS: Record<PrintOrderStatus, string> = {
  AWAITING_PAYMENT: "À régler",
  PAYMENT_SUBMITTED: "Paiement en cours de vérification",
  PAID: "Paiement reçu : commande en préparation",
  SENDING: "Paiement reçu : commande en préparation",
  SENT_TO_LULU: "En fabrication chez notre prestataire d'impression",
  LOCAL_PENDING: "En préparation (livraison au Burkina Faso)",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  ERROR: "Paiement reçu : commande en préparation",
  CANCELED: "Annulée",
};

export const ROUTE_LABELS: Record<string, string> = {
  LOCAL_MANUAL: "Traitement local (Burkina Faso)",
  LULU_AUTO: "Impression et livraison par Lulu",
  BLOCKED_ADDRESS: "Adresse à corriger",
};
