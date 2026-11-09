// src/lib/fulfilment-routing.ts
// Règle de routage des livres imprimés à la demande :
// - acheteur au Burkina Faso : l'envoi automatique vers Lulu est BLOQUÉ (traitement local manuel) ;
// - acheteur à l'étranger : envoi automatique vers Lulu autorisé ;
// - pays absent ou invalide : envoi bloqué (on n'imprime pas et on n'expédie pas à une adresse douteuse).
// Fichier autonome, sans dépendance.

export const LOCAL_COUNTRY_CODE = "BF";

export type FulfilmentRoute = "LOCAL_MANUAL" | "LULU_AUTO" | "BLOCKED_ADDRESS";

export interface RoutingDecision {
  route: FulfilmentRoute;
  // Code pays ISO 3166-1 alpha-2 normalisé, ou null si le pays est inconnu
  countryCode: string | null;
  reason: string;
}

const COUNTRY_ALIASES: Record<string, string> = {
  BF: "BF",
  BFA: "BF",
  BURKINA: "BF",
  "BURKINA FASO": "BF",
  "BURKINA-FASO": "BF",
};

/** Code pays à deux lettres majuscules, ou null. Accepte aussi le code à trois lettres et le nom du Burkina Faso. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const cleaned = raw
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (cleaned === "") return null;

  const alias = COUNTRY_ALIASES[cleaned];
  if (alias) return alias;

  return /^[A-Z]{2}$/.test(cleaned) ? cleaned : null;
}

/** Décide de la voie de traitement d'un livre imprimé selon le pays de livraison de l'acheteur. */
export function decideFulfilmentRoute(rawCountry: string | null | undefined): RoutingDecision {
  const countryCode = normalizeCountryCode(rawCountry);

  if (!countryCode) {
    return {
      route: "BLOCKED_ADDRESS",
      countryCode: null,
      reason:
        "Pays de livraison absent ou invalide : l'envoi automatique est bloqué jusqu'à la correction de l'adresse.",
    };
  }

  if (countryCode === LOCAL_COUNTRY_CODE) {
    return {
      route: "LOCAL_MANUAL",
      countryCode,
      reason:
        "Acheteur au Burkina Faso : l'envoi automatique vers Lulu est bloqué, la commande est à traiter localement.",
    };
  }

  return {
    route: "LULU_AUTO",
    countryCode,
    reason: `Acheteur à l'étranger (${countryCode}) : impression et livraison par Lulu.`,
  };
}
