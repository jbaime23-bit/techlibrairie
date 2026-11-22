// src/lib/assembly/dossier-types.ts
// Dossier d'assemblage : les informations d'un livre en cours d'édition, transmises au module d'assemblage.
// Types seulement : aucun accès à la base ici (le module d'assemblage est un composant du navigateur).

export type DossierKind = "projet" | "manuscrit";

export interface AssemblyDossier {
  kind: DossierKind;
  // Identifiant du produit (projet à compte d'auteur) ou du manuscrit soumis (compte d'éditeur)
  id: string;
  // Produit auquel envoyer l'épreuve et les fichiers d'impression ; null pour un manuscrit sans fiche livre
  productId: string | null;
  label: string;
  title: string;
  subtitle: string;
  author: string;
  summary: string;
  bio: string;
  isbn: string;
  year: string;
  coverUrl: string | null;
  photoUrl: string | null;
  manuscriptDownloadUrl: string;
  manuscriptFileName: string;
  // L'épreuve peut être envoyée (forfait validé, édition en cours de mise en page)
  canSendProof: boolean;
  nextProofVersion: number;
  // Compte d'éditeur : contrat signé ou non (null pour un compte d'auteur)
  contractSigned: boolean | null;
}

export interface AssemblyDossierSummary {
  kind: DossierKind;
  id: string;
  title: string;
  author: string;
  label: string;
  detail: string;
}
