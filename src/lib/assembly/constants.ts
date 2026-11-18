// src/lib/assembly/constants.ts
// Constantes du module d'assemblage éditeur : formats, papiers, marges, seuils du dos carré collé.

export type TrimKey = "A5" | "6x9" | "A4";
export type PaperKey = "80" | "90";
export type FontFamily = "times" | "helvetica";

export interface TrimFormat {
  key: TrimKey;
  label: string;
  widthMm: number;
  heightMm: number;
  defaultFontPt: number;
}

export interface PaperOption {
  key: PaperKey;
  label: string;
  // Épaisseur d'une feuille (deux pages), en millimètres
  sheetThicknessMm: number;
}

export const TRIM_FORMATS: TrimFormat[] = [
  { key: "A5", label: "A5 (148 x 210 mm)", widthMm: 148, heightMm: 210, defaultFontPt: 11 },
  { key: "6x9", label: "6 x 9 pouces (152 x 229 mm)", widthMm: 152, heightMm: 229, defaultFontPt: 11 },
  { key: "A4", label: "A4 (210 x 297 mm)", widthMm: 210, heightMm: 297, defaultFontPt: 12 },
];

export const PAPER_OPTIONS: PaperOption[] = [
  { key: "80", label: "80 g/m² standard (0,10 mm par feuille)", sheetThicknessMm: 0.1 },
  { key: "90", label: "90 g/m² bouffant (0,12 mm par feuille)", sheetThicknessMm: 0.12 },
];

export const BRAND_NAME = "techlibrairie Edition";
export const DEFAULT_YEAR = "2026";
export const LOGO_PUBLIC_PATH = "/logo-edition.png";

// Dos carré collé : nombre minimal de pages
export const MIN_PAGES_PERFECT_BOUND = 44;
// Faux-titre, page blanche, page de titre, page de copyright
export const FRONT_MATTER_PAGES = 4;
// Fonds perdus autour de la couverture à plat
export const BLEED_MM = 3;

export const MARGINS = {
  innerMm: 18,
  outerMm: 15,
  topMm: 15,
  bottomMm: 18,
};

export const MM_PER_PT = 25.4 / 72;

// Tranche : en dessous, pas de texte ; au-dessus, le mini-logo apparaît
export const MIN_SPINE_TEXT_MM = 3;
export const MIN_SPINE_LOGO_MM = 7;

/** Épaisseur du dos en millimètres : (pages / 2) feuilles x épaisseur d'une feuille. */
export function spineWidthMm(totalPages: number, sheetThicknessMm: number): number {
  return (totalPages / 2) * sheetThicknessMm;
}

export function cssFontStack(family: FontFamily): string {
  return family === "times" ? '"Times New Roman", Times, serif' : "Helvetica, Arial, sans-serif";
}
