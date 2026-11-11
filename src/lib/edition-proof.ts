// src/lib/edition-proof.ts
// Constantes et contrôles du circuit maquette -> bon à tirer (BAT) -> publication.
// Les délais et nombres doivent rester alignés sur le contrat d'édition à compte d'auteur (lib/edition-contract.ts).

export const PROOF_PATH_PREFIX = "edition/";
export const INCLUDED_CORRECTION_ROUNDS = 2;
export const LAYOUT_DELAY_DAYS = 30;
export const PROOF_REVIEW_DAYS = 15;

/** Texte que l'auteur accepte en approuvant une épreuve (annexe D du contrat). */
export function batApprovalText(version: number): string {
  return `Je certifie avoir relu l'épreuve de la maquette (version ${version}) et j'approuve sa publication en l'état. Je comprends que les erreurs qu'elle contient ne pourront pas être reprochées à TechLibrairie Édition.`;
}

/** Identifiant de l'ouvrage contenu dans la clé d'une épreuve (edition/<ouvrage>/<fichier>.pdf), ou null. */
export function productIdFromProofKey(key: string): string | null {
  const match = /^edition\/([a-z0-9]{1,40})\/[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/i.exec(key);
  return match ? match[1] : null;
}

/** Vérifie qu'une clé de stockage est bien une épreuve de cet ouvrage. */
export function isProofKeyFor(productId: string, key: string): boolean {
  return key.length <= 300 && productIdFromProofKey(key) === productId;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
