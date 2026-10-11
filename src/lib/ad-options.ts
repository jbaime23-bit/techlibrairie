// src/lib/ad-options.ts
// Libellés et valeurs des emplacements et types de publicités.
// "active" indique si l'emplacement est réellement affiché sur le site.

export const AD_PLACEMENTS = [
  { value: "HOME_TOP", label: "Accueil - haut de page", active: true },
  { value: "HOME_MIDDLE", label: "Accueil - milieu de page", active: true },
  { value: "HOME_BOTTOM", label: "Accueil - bas de page", active: true },
  {
    value: "SELLER_DASHBOARD",
    label: "Espace vendeur - bas de chaque page",
    active: true,
  },
  {
    value: "DOWNLOAD_CONFIRMATION",
    label: "Confirmation de paiement et téléchargement",
    active: true,
  },
  {
    value: "CATALOGUE_TOP",
    label: "Catalogue - haut (pas encore affiché)",
    active: false,
  },
  {
    value: "CATALOGUE_SIDEBAR",
    label: "Catalogue - colonne latérale (pas encore affiché)",
    active: false,
  },
  {
    value: "BOOK_PAGE",
    label: "Page d'un ouvrage (pas encore affiché)",
    active: false,
  },
  {
    value: "FOOTER_TOP",
    label: "Au-dessus du pied de page (pas encore affiché)",
    active: false,
  },
] as const;

export const AD_KINDS = [
  { value: "LOCAL_BANNER", label: "Bannière locale (entreprise tierce)" },
  { value: "ADSTERRA_BANNER", label: "Adsterra - Bannière 728x90" },
  { value: "ADSTERRA_NATIVE", label: "Adsterra - Widget natif" },
  { value: "ADSTERRA_SCRIPT", label: "Adsterra - Script externe" },
  { value: "ADSTERRA_DIRECT_LINK", label: "Adsterra - Lien direct (bouton)" },
  { value: "ADSTERRA_POPUNDER", label: "Adsterra - PopUnder" },
] as const;

export type AdPlacementValue = (typeof AD_PLACEMENTS)[number]["value"];
export type AdKindValue = (typeof AD_KINDS)[number]["value"];

export const AD_PLACEMENT_VALUES = AD_PLACEMENTS.map(
  (placement) => placement.value
) as [AdPlacementValue, ...AdPlacementValue[]];

export const AD_KIND_VALUES = AD_KINDS.map((kind) => kind.value) as [
  AdKindValue,
  ...AdKindValue[],
];

export function adPlacementLabel(value: string): string {
  return AD_PLACEMENTS.find((placement) => placement.value === value)?.label ?? value;
}

export function adKindLabel(value: string): string {
  return AD_KINDS.find((kind) => kind.value === value)?.label ?? value;
}

export function isActivePlacement(value: string): boolean {
  return AD_PLACEMENTS.some(
    (placement) => placement.value === value && placement.active
  );
  }
