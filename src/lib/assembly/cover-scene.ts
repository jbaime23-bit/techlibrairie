// src/lib/assembly/cover-scene.ts
// Couverture complète à plat : 4e de couverture, tranche et 1re de couverture, avec 3 mm de fonds perdus.
// Le module produit une « scène » (rectangles, images, textes) dessinée à l'écran en SVG et exportée en PDF.

import {
  MIN_SPINE_LOGO_MM,
  MIN_SPINE_TEXT_MM,
  MM_PER_PT,
  type FontFamily,
} from "@/lib/assembly/constants";
import type { TextAlign, TextMeasurer, TextStyle } from "@/lib/assembly/interior-layout";

export interface RectItem {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity?: number;
  radius?: number;
}

export interface ImageItem {
  kind: "image";
  src: string;
  format: "PNG" | "JPEG";
  x: number;
  y: number;
  w: number;
  h: number;
  // « cover » : recadrée pour remplir le cadre ; « contain » : affichée entière
  fit: "cover" | "contain";
}

export interface CoverTextItem {
  kind: "text";
  text: string;
  x: number;
  // Ligne de base (texte horizontal) ou début du texte (texte de la tranche)
  y: number;
  sizePt: number;
  style: TextStyle;
  align: TextAlign;
  color: string;
  family: FontFamily;
  // 90 : texte tourné de 90 degrés dans le sens des aiguilles d'une montre (lecture de haut en bas)
  rotate?: 90;
}

export type CoverItem = RectItem | ImageItem | CoverTextItem;

export interface CoverScene {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  trimWidthMm: number;
  trimHeightMm: number;
  spineMm: number;
  bgColor: string;
  items: CoverItem[];
  warnings: string[];
}

export interface PlacedImage {
  dataUrl: string;
  aspect: number;
}

export interface CoverImageInfo {
  dataUrl: string;
  width: number;
  height: number;
}

export interface BarcodeImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface CoverParams {
  measurer: TextMeasurer;
  trim: { widthMm: number; heightMm: number };
  spineMm: number;
  bleedMm: number;
  info: {
    title: string;
    subtitle: string;
    author: string;
    summary: string;
    bio: string;
    isbnDisplay: string | null;
  };
  style: {
    bgColor: string;
    textColor: string;
    fontFamily: FontFamily;
    layout: "centered" | "full";
    band: boolean;
  };
  frontImage: CoverImageInfo | null;
  logoFull: PlacedImage | null;
  logoIcon: PlacedImage | null;
  // Fond blanc derrière le logo (logo importé, posé sur un fond sombre)
  logoPlate: boolean;
  barcode: BarcodeImage | null;
}

// Un code-barres EAN-13 à 100 % mesure 37,29 mm pour 570 pixels de barres (6 pixels par module)
const BARCODE_MM_PER_PX = 37.29 / 570;

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

interface FitResult {
  pt: number;
  lines: string[];
}

export function buildCoverScene(p: CoverParams): CoverScene {
  const m = p.measurer;
  const b = p.bleedMm;
  const tw = p.trim.widthMm;
  const th = p.trim.heightMm;
  const spine = p.spineMm;
  const W = 2 * tw + spine + 2 * b;
  const H = th + 2 * b;
  const s = tw / 148;
  const family = p.style.fontFamily;
  const color = p.style.textColor;
  const items: CoverItem[] = [];
  const warnings: string[] = [];

  const spineX0 = b + tw;
  const frontX0 = spineX0 + spine;
  const frontCx = frontX0 + tw / 2;
  const bottomEdge = b + th;

  const fit = (
    text: string,
    style: TextStyle,
    width: number,
    startPt: number,
    minPt: number,
    maxLines: number
  ): FitResult => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return { pt: minPt, lines: [] };

    let pt = startPt;

    while (pt >= minPt) {
      m.setFont(family, style);
      m.setFontSize(pt);
      const lines = m.splitTextToSize(clean, width);
      const widest = lines.reduce((max, line) => Math.max(max, m.getTextWidth(line)), 0);

      if (lines.length <= maxLines && widest <= width * 1.001) return { pt, lines };
      pt -= 0.5;
    }

    m.setFont(family, style);
    m.setFontSize(minPt);
    return { pt: minPt, lines: m.splitTextToSize(clean, width).slice(0, maxLines) };
  };

  const stepOf = (pt: number, factor: number): number => pt * MM_PER_PT * factor;

  const emitLines = (
    lines: string[],
    x: number,
    top: number,
    pt: number,
    style: TextStyle,
    align: TextAlign,
    textColor: string,
    factor: number
  ): void => {
    lines.forEach((line, index) => {
      items.push({
        kind: "text",
        text: line,
        x,
        y: top + pt * MM_PER_PT * 0.92 + index * stepOf(pt, factor),
        sizePt: pt,
        style,
        align,
        color: textColor,
        family,
      });
    });
  };

  const sized = (
    logo: PlacedImage | null,
    maxW: number,
    maxH: number
  ): { w: number; h: number } | null => {
    if (!logo) return null;

    let h = maxH;
    let w = h * logo.aspect;

    if (w > maxW) {
      w = maxW;
      h = w / logo.aspect;
    }

    return { w, h };
  };

  const pushLogo = (logo: PlacedImage, x: number, y: number, w: number, h: number): void => {
    if (p.logoPlate) {
      items.push({ kind: "rect", x: x - 1.5, y: y - 1.5, w: w + 3, h: h + 3, fill: "#ffffff", radius: 1.5 });
    }

    items.push({
      kind: "image",
      src: logo.dataUrl,
      format: imageFormat(logo.dataUrl),
      x,
      y,
      w,
      h,
      fit: "contain",
    });
  };

  // Fond de toute la planche (fonds perdus compris)
  items.push({ kind: "rect", x: 0, y: 0, w: W, h: H, fill: p.style.bgColor });

  // ---- 1re de couverture ------------------------------------------------------------------------

  const margin = 14 * s;
  const innerW = tw - 2 * margin;
  const title = p.info.title.trim() || "Titre du livre";

  const titleFit = fit(title, "bold", innerW, 36 * s, 16, 5);
  const titleTop = b + 16 * s;
  const titleHeight = titleFit.lines.length * stepOf(titleFit.pt, 1.15);

  let headerBottom = titleTop + titleHeight;
  let subtitleFit: FitResult | null = null;
  let subtitleTop = 0;

  if (p.info.subtitle.trim()) {
    subtitleFit = fit(p.info.subtitle, "italic", innerW, 17 * s, 9, 3);
    subtitleTop = headerBottom + 5 * s;
    headerBottom = subtitleTop + subtitleFit.lines.length * stepOf(subtitleFit.pt, 1.25);
  }

  const frontLogoSize = sized(p.logoFull, 44 * s, 11 * s);
  const frontLogoTop = bottomEdge - 10 * s - (frontLogoSize?.h ?? 0);

  const authorFit = fit(p.info.author, "bold", innerW, 17 * s, 9, 2);
  const authorHeight = authorFit.lines.length * stepOf(authorFit.pt, 1.2);
  const authorTop = frontLogoTop - 5 * s - authorHeight;

  const fullMode = p.style.layout === "full" && p.frontImage !== null;

  if (fullMode && p.frontImage) {
    items.push({
      kind: "image",
      src: p.frontImage.dataUrl,
      format: imageFormat(p.frontImage.dataUrl),
      x: frontX0,
      y: 0,
      w: tw + b,
      h: H,
      fit: "cover",
    });

    if (p.style.band) {
      items.push({ kind: "rect", x: frontX0, y: 0, w: tw + b, h: headerBottom + 6 * s, fill: "#000000", opacity: 0.45 });
      const bottomBandTop = authorTop - 6 * s;
      items.push({
        kind: "rect",
        x: frontX0,
        y: bottomBandTop,
        w: tw + b,
        h: H - bottomBandTop,
        fill: "#000000",
        opacity: 0.45,
      });
    }
  } else if (p.frontImage) {
    const imageTop = headerBottom + 6 * s;
    const imageBottom = authorTop - 6 * s;

    if (imageBottom - imageTop >= 30 * s) {
      items.push({
        kind: "image",
        src: p.frontImage.dataUrl,
        format: imageFormat(p.frontImage.dataUrl),
        x: frontCx - innerW / 2,
        y: imageTop,
        w: innerW,
        h: imageBottom - imageTop,
        fit: "cover",
      });
    } else {
      warnings.push(
        "Pas assez de place pour l'image de couverture avec ce titre : raccourcissez le titre ou choisissez « Image plein cadre »."
      );
    }
  }

  emitLines(titleFit.lines, frontCx, titleTop, titleFit.pt, "bold", "center", color, 1.15);

  if (subtitleFit) {
    emitLines(subtitleFit.lines, frontCx, subtitleTop, subtitleFit.pt, "italic", "center", color, 1.25);
  }

  emitLines(authorFit.lines, frontCx, authorTop, authorFit.pt, "bold", "center", color, 1.2);

  if (p.logoFull && frontLogoSize) {
    pushLogo(p.logoFull, frontCx - frontLogoSize.w / 2, frontLogoTop, frontLogoSize.w, frontLogoSize.h);
  }

  // ---- Tranche ----------------------------------------------------------------------------------

  if (spine >= MIN_SPINE_TEXT_MM) {
    const xc = spineX0 + spine / 2;
    const spineTop = b + 14 * s;

    const logoSize = spine >= MIN_SPINE_LOGO_MM && p.logoIcon ? sized(p.logoIcon, Math.min(spine - 2, 12), 12) : null;
    const logoY = logoSize ? bottomEdge - 10 * s - logoSize.h : bottomEdge - 10 * s;
    const limit = logoY - 6 * s;
    const maxLength = limit - spineTop;

    const measure = (text: string, pt: number, style: TextStyle): number => {
      m.setFont(family, style);
      m.setFontSize(pt);
      return m.getTextWidth(text);
    };

    const truncate = (text: string, pt: number, style: TextStyle, budget: number): string => {
      if (measure(text, pt, style) <= budget) return text;

      let cut = text;
      while (cut.length > 3 && measure(`${cut}…`, pt, style) > budget) {
        cut = cut.slice(0, -1);
      }
      return `${cut.trimEnd()}…`;
    };

    let titlePt = Math.min(20, (spine / MM_PER_PT) * 0.55);
    const titleBudget = maxLength * 0.62;

    while (titlePt > 6 && measure(title, titlePt, "bold") > titleBudget) {
      titlePt -= 0.5;
    }
    titlePt = Math.max(titlePt, 6);

    const spineTitle = truncate(title, titlePt, "bold", titleBudget);
    const spineTitleLength = measure(spineTitle, titlePt, "bold");

    items.push({
      kind: "text",
      text: spineTitle,
      x: xc - titlePt * MM_PER_PT * 0.35,
      y: spineTop,
      sizePt: titlePt,
      style: "bold",
      align: "left",
      color,
      family,
      rotate: 90,
    });

    const authorText = p.info.author.trim();
    const authorBudget = maxLength - spineTitleLength - 6 * s;

    if (authorText && authorBudget >= 12) {
      const spineAuthorPt = Math.max(6, Math.min(titlePt * 0.75, 12));
      const spineAuthor = truncate(authorText, spineAuthorPt, "normal", authorBudget);
      const authorLength = measure(spineAuthor, spineAuthorPt, "normal");

      items.push({
        kind: "text",
        text: spineAuthor,
        x: xc - spineAuthorPt * MM_PER_PT * 0.35,
        y: limit - authorLength,
        sizePt: spineAuthorPt,
        style: "normal",
        align: "left",
        color,
        family,
        rotate: 90,
      });
    }

    if (p.logoIcon && logoSize) {
      pushLogo(p.logoIcon, xc - logoSize.w / 2, logoY, logoSize.w, logoSize.h);
    }
  } else {
    warnings.push(
      `La tranche ne mesure que ${spine.toFixed(2).replace(".", ",")} mm : trop fine pour y imprimer du texte (minimum ${MIN_SPINE_TEXT_MM} mm).`
    );
  }

  // ---- 4e de couverture -------------------------------------------------------------------------

  const backX = b + 14 * s;
  const backW = tw - 14 * s - 12 * s;

  const backLogoSize = sized(p.logoFull, 40 * s, 10 * s);
  const backLogoY = backLogoSize ? bottomEdge - 10 * s - backLogoSize.h : bottomEdge - 14 * s;

  let barcodeBox: { x: number; y: number; w: number; h: number; imgW: number; imgH: number } | null = null;

  if (p.barcode) {
    const imgW = p.barcode.width * BARCODE_MM_PER_PX;
    const imgH = p.barcode.height * BARCODE_MM_PER_PX;
    const pad = 3;
    const textH = 5;
    const boxW = imgW + 2 * pad;
    const boxH = imgH + textH + 2 * pad;

    barcodeBox = {
      x: b + tw - 12 * s - boxW,
      y: bottomEdge - 10 * s - boxH,
      w: boxW,
      h: boxH,
      imgW,
      imgH,
    };
  }

  const textTop = b + 16 * s;
  const textBottom = Math.min(barcodeBox?.y ?? Infinity, backLogoY, bottomEdge - 14 * s) - 6 * s;
  const available = textBottom - textTop;

  const summaryParagraphs = p.info.summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bioText = p.info.bio.replace(/\s+/g, " ").trim();

  const layoutBack = (pt: number): { summary: string[]; bio: string[]; step: number; height: number } => {
    const step = stepOf(pt, 1.35);
    m.setFont(family, "normal");
    m.setFontSize(pt);

    const summary: string[] = [];
    summaryParagraphs.forEach((paragraph, index) => {
      if (index > 0) summary.push("");
      summary.push(...m.splitTextToSize(paragraph.replace(/\s+/g, " "), backW));
    });

    const bio = bioText ? m.splitTextToSize(bioText, backW) : [];

    let height = 0;
    for (const line of summary) height += line === "" ? step * 0.5 : step;
    if (bio.length > 0) height += step * 1.2 + step + bio.length * step;

    return { summary, bio, step, height };
  };

  let backPt = 10.5 * s;
  let back = layoutBack(backPt);

  while (back.height > available && backPt > 7) {
    backPt -= 0.5;
    back = layoutBack(backPt);
  }

  if (back.height > available) {
    warnings.push("Le texte de la 4e de couverture est trop long : il a été raccourci. Réduisez le résumé ou la biographie.");

    const step = back.step;
    let remaining = available;
    const keptSummary: string[] = [];
    const keptBio: string[] = [];

    if (back.bio.length > 0) {
      const bioBudgetLines = Math.max(2, Math.floor((available * 0.3) / step) - 2);
      keptBio.push(...back.bio.slice(0, bioBudgetLines));
      remaining -= step * 2.2 + keptBio.length * step;
    }

    for (const line of back.summary) {
      const cost = line === "" ? step * 0.5 : step;
      if (remaining - cost < 0) break;
      keptSummary.push(line);
      remaining -= cost;
    }

    if (keptSummary.length > 0 && keptSummary.length < back.summary.length) {
      const last = keptSummary[keptSummary.length - 1];
      keptSummary[keptSummary.length - 1] = `${last.replace(/[ .,;:!?]+$/, "")}…`;
    }

    back = { summary: keptSummary, bio: keptBio, step, height: available };
  }

  let cursor = textTop;

  back.summary.forEach((line) => {
    if (line === "") {
      cursor += back.step * 0.5;
      return;
    }

    emitLines([line], backX, cursor, backPt, "normal", "left", color, 1.35);
    cursor += back.step;
  });

  if (back.bio.length > 0) {
    cursor += back.step * 1.2;
    emitLines(["À propos de l'auteur"], backX, cursor, backPt, "bold", "left", color, 1.35);
    cursor += back.step;
    emitLines(back.bio, backX, cursor, backPt, "normal", "left", color, 1.35);
  }

  if (p.logoFull && backLogoSize) {
    pushLogo(p.logoFull, backX, backLogoY, backLogoSize.w, backLogoSize.h);
  }

  if (p.barcode && barcodeBox) {
    items.push({
      kind: "rect",
      x: barcodeBox.x,
      y: barcodeBox.y,
      w: barcodeBox.w,
      h: barcodeBox.h,
      fill: "#ffffff",
      radius: 1,
    });

    items.push({
      kind: "text",
      text: `ISBN ${p.info.isbnDisplay ?? ""}`.trim(),
      x: barcodeBox.x + barcodeBox.w / 2,
      y: barcodeBox.y + 3 + 3.4,
      sizePt: 8,
      style: "bold",
      align: "center",
      color: "#000000",
      family: "helvetica",
    });

    items.push({
      kind: "image",
      src: p.barcode.dataUrl,
      format: "PNG",
      x: barcodeBox.x + 3,
      y: barcodeBox.y + 3 + 5,
      w: barcodeBox.imgW,
      h: barcodeBox.imgH,
      fit: "contain",
    });
  }

  return {
    widthMm: W,
    heightMm: H,
    bleedMm: b,
    trimWidthMm: tw,
    trimHeightMm: th,
    spineMm: spine,
    bgColor: p.style.bgColor,
    items,
    warnings,
  };
}
