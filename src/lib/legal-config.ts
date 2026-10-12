// src/lib/legal-config.ts
// Informations légales de l'exploitant du site, lues dans les variables d'environnement.
// Aucun texte "à compléter" n'est affiché aux visiteurs : une information absente est simplement omise.

// Date de dernière mise à jour des documents légaux (à modifier quand vous les révisez).
export const LEGAL_UPDATED_AT = "12 octobre 2026";

export interface LegalConfig {
  name: string | null;
  address: string | null;
  registration: string | null;
  director: string | null;
  country: string;
}

function clean(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function getLegalConfig(): LegalConfig {
  return {
    name: clean(process.env.LEGAL_NAME, 150),
    address: clean(process.env.LEGAL_ADDRESS, 250),
    registration: clean(process.env.LEGAL_REGISTRATION, 150),
    director: clean(process.env.LEGAL_PUBLICATION_DIRECTOR, 100),
    country: clean(process.env.LEGAL_COUNTRY, 60) ?? "Burkina Faso",
  };
}

/** Variables obligatoires encore absentes (affichées uniquement à l'administrateur). */
export function missingLegalFields(config: LegalConfig): string[] {
  const missing: string[] = [];
  if (!config.name) missing.push("LEGAL_NAME (nom ou raison sociale de l'exploitant)");
  if (!config.address) missing.push("LEGAL_ADDRESS (adresse de l'exploitant)");
  return missing;
}

/** Nom de l'exploitant tel qu'il apparaît dans les textes. */
export function operatorName(config: LegalConfig): string {
  return config.name ?? "l'exploitant de TechLibrairie";
    }
