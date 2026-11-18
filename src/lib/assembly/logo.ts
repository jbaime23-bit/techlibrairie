// src/lib/assembly/logo.ts
// Logo « techlibrairie Edition » : le fichier officiel /logo-edition.png s'il existe, sinon un logo vectoriel
// de secours dessiné en code. Un logo personnalisé peut être mémorisé sur l'appareil.

import { LOGO_PUBLIC_PATH } from "@/lib/assembly/constants";
import { loadImage, readFileAsDataUrl } from "@/lib/assembly/image-utils";

export interface LogoImage {
  dataUrl: string;
  // Largeur divisée par hauteur
  aspect: number;
}

export interface LogoSet {
  source: "fallback" | "file" | "custom";
  label: string;
  // Vrai si l'encre peut être inversée (logo vectoriel) : variantes claire et foncée différentes
  recolorable: boolean;
  fullDark: LogoImage;
  fullLight: LogoImage;
  iconDark: LogoImage;
  iconLight: LogoImage;
}

const CUSTOM_LOGO_KEY = "tl-assembly-logo-v1";

const INK_DARK = "#312e81";
const ACCENT_DARK = "#f97316";
const INK_LIGHT = "#ffffff";
const ACCENT_LIGHT = "#fdba74";

function iconMarkup(ink: string, accent: string): string {
  return [
    `<path d="M14 46 Q64 26 100 50 L100 176 Q64 152 14 170 Z" fill="${ink}"/>`,
    `<path d="M186 46 Q136 26 100 50 L100 176 Q136 152 186 170 Z" fill="${ink}" fill-opacity="0.82"/>`,
    `<path d="M100 50 L100 176" stroke="${accent}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
    `<path d="M126 36 L126 104 L141 90 L156 104 L156 42 Z" fill="${accent}"/>`,
  ].join("");
}

function iconSvg(ink: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${iconMarkup(ink, accent)}</svg>`;
}

function fullSvg(ink: string, accent: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200">`,
    iconMarkup(ink, accent),
    `<text x="222" y="108" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="700" fill="${ink}">techlibrairie</text>`,
    `<text x="226" y="160" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" letter-spacing="16" fill="${accent}">Edition</text>`,
    `</svg>`,
  ].join("");
}

async function svgToImage(svg: string, width: number, height: number): Promise<LogoImage> {
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas dessiner le logo.");

  context.drawImage(image, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL("image/png"), aspect: width / height };
}

export async function buildFallbackLogoSet(): Promise<LogoSet> {
  const [fullDark, fullLight, iconDark, iconLight] = await Promise.all([
    svgToImage(fullSvg(INK_DARK, ACCENT_DARK), 2400, 600),
    svgToImage(fullSvg(INK_LIGHT, ACCENT_LIGHT), 2400, 600),
    svgToImage(iconSvg(INK_DARK, ACCENT_DARK), 800, 800),
    svgToImage(iconSvg(INK_LIGHT, ACCENT_LIGHT), 800, 800),
  ]);

  return {
    source: "fallback",
    label: "Logo vectoriel de secours",
    recolorable: true,
    fullDark,
    fullLight,
    iconDark,
    iconLight,
  };
}

async function imageToLogoImage(src: string, maxPx = 1600): Promise<LogoImage> {
  const image = await loadImage(src);
  const scale = Math.min(1, maxPx / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas traiter le logo.");

  context.drawImage(image, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL("image/png"), aspect: width / height };
}

async function buildLogoSetFromSource(
  src: string,
  source: "file" | "custom",
  label: string
): Promise<LogoSet> {
  const logo = await imageToLogoImage(src);

  return {
    source,
    label,
    recolorable: false,
    fullDark: logo,
    fullLight: logo,
    iconDark: logo,
    iconLight: logo,
  };
}

/** Logo choisi par l'utilisateur : il est mémorisé sur cet appareil. */
export async function logoFromFile(file: File): Promise<LogoSet> {
  const dataUrl = await readFileAsDataUrl(file);
  const set = await buildLogoSetFromSource(dataUrl, "custom", file.name);

  try {
    window.localStorage.setItem(CUSTOM_LOGO_KEY, set.fullDark.dataUrl);
  } catch {
    // Mémorisation impossible (espace plein) : le logo reste utilisable pour cette session.
  }

  return set;
}

export function clearCustomLogo(): void {
  try {
    window.localStorage.removeItem(CUSTOM_LOGO_KEY);
  } catch {
    // Rien à faire.
  }
}

/** Logo officiel (/logo-edition.png) ou, à défaut, logo vectoriel de secours. */
export async function loadOfficialLogo(): Promise<LogoSet> {
  try {
    return await buildLogoSetFromSource(`${LOGO_PUBLIC_PATH}?v=1`, "file", "Logo officiel (logo-edition.png)");
  } catch {
    return buildFallbackLogoSet();
  }
}

/** Logo à utiliser au démarrage : celui mémorisé sur l'appareil, sinon l'officiel, sinon le secours. */
export async function loadInitialLogo(): Promise<LogoSet> {
  try {
    const stored = window.localStorage.getItem(CUSTOM_LOGO_KEY);
    if (stored) {
      return await buildLogoSetFromSource(stored, "custom", "Logo personnalisé");
    }
  } catch {
    // On continue avec le logo officiel.
  }

  return loadOfficialLogo();
}
