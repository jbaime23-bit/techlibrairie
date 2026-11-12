// src/lib/edition-labels.ts
// Libellés et couleurs des étapes d'une édition à compte d'auteur (utilisables côté serveur et navigateur).

import type { EditionStage } from "@prisma/client";

// Séries de corrections de la maquette incluses dans le forfait (article 6 du contrat)
export const INCLUDED_CORRECTION_ROUNDS = 2;

export const EDITION_STAGE_LABELS: Record<EditionStage, string> = {
  FEE_PENDING: "Forfait à régler",
  IN_LAYOUT: "En maquette",
  PROOF_PENDING: "Bon à tirer à valider",
  CHANGES_REQUESTED: "Corrections demandées",
  PUBLISHED: "Publié",
  REFUSED: "Refusé",
};

export const EDITION_STAGE_STYLES: Record<EditionStage, string> = {
  FEE_PENDING: "bg-yellow-100 text-yellow-800",
  IN_LAYOUT: "bg-blue-100 text-blue-800",
  PROOF_PENDING: "bg-purple-100 text-purple-800",
  CHANGES_REQUESTED: "bg-orange-100 text-orange-800",
  PUBLISHED: "bg-green-100 text-green-800",
  REFUSED: "bg-red-100 text-red-800",
};
