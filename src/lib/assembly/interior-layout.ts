// src/lib/assembly/interior-layout.ts
// Mise en page du corps du livre : pages liminaires, chapitres, pagination, pages blanches et achevé d'imprimer.
// Le moteur ne dessine rien : il produit un modèle de pages, utilisé à la fois pour l'aperçu et pour le PDF.

import {
  BRAND_NAME,
  FRONT_MATTER_PAGES,
  MARGINS,
  MIN_PAGES_PERFECT_BOUND,
  MM_PER_PT,
  type FontFamily,
} from "@/lib/assembly/constants";
import type { Block } from "@/lib/assembly/manuscript";

/** Mesure de texte (fournie par jsPDF, en millimètres). */
export interface TextMeasurer {
  setFont(fontName: string, fontStyle?: string): unknown;
  setFontSize(size: number): unknown;
  getTextWidth(text: string): number;
  splitTextToSize(text: string, maxWidth: number): string[];
}

export type TextStyle = "normal" | "bold" | "italic";
export type TextAlign = "left" | "center" | "right";
export type PageKind = "fauxtitre" | "blank" | "titre" | "copyright" | "body" | "padding" | "colophon";

export interface PageText {
  text: string;
  x: number;
  // Ligne de base, en millimètres depuis le haut de la page
  y: number;
  sizePt: number;
  style: TextStyle;
  align: TextAlign;
  // Espace supplémentaire entre les mots, pour justifier la ligne
  wordSpaceMm?: number;
}

export interface PageImage {
  dataUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutPage {
  index: number;
  kind: PageKind;
  // Première page d'un chapitre : pas de numéro de page
  opening: boolean;
  items: PageText[];
  images: PageImage[];
}

export interface InteriorLayout {
  pages: LayoutPage[];
  totalPages: number;
  // Pages entre les pages liminaires et l'achevé d'imprimer, pages blanches de début de chapitre comprises
  bodyPages: number;
  // Pages blanches ajoutées pour obtenir un multiple de 4
  paddingPages: number;
  // Pages manquantes pour atteindre le minimum du dos carré collé
  missingForMinimum: number;
  trimWidthMm: number;
  trimHeightMm: number;
  fontFamily: FontFamily;
}

export interface InteriorOptions {
  fontFamily: FontFamily;
  fontPt: number;
  lineFactor: number;
  justify: boolean;
  chapterOnRecto: boolean;
  colophonLast: boolean;
  restartNumbering: boolean;
}

export interface InteriorInfo {
  title: string;
  subtitle: string;
  author: string;
  year: string;
  isbnDisplay: string | null;
}

export interface LogoImageRef {
  dataUrl: string;
  aspect: number;
}

export interface InteriorParams {
  measurer: TextMeasurer;
  trim: { widthMm: number; heightMm: number };
  info: InteriorInfo;
  blocks: Block[];
  options: InteriorOptions;
  logo: LogoImageRef | null;
}

const round05 = (value: number): number => Math.round(value * 2) / 2;

export function buildInteriorLayout(p: InteriorParams): InteriorLayout {
  const m = p.measurer;
  const W = p.trim.widthMm;
  const H = p.trim.heightMm;
  const o = p.options;
  const family = o.fontFamily;
  const scale = W / 148;
  const bodyPt = o.fontPt;
  const lineMm = bodyPt * o.lineFactor * MM_PER_PT;
  const textWidth = W - MARGINS.innerMm - MARGINS.outerMm;
  const bottomLimit = H - MARGINS.bottomMm;
  const pages: LayoutPage[] = [];

  const title = p.info.title.trim() || "Titre du livre";
  const author = p.info.author.trim();
  const year = p.info.year.trim();

  // Page 1, 3, 5... : à droite (marge de reliure à gauche) ; pages paires : à gauche
  const leftOf = (index: number): number => (index % 2 === 1 ? MARGINS.innerMm : MARGINS.outerMm);
  const centerOf = (index: number): number => leftOf(index) + textWidth / 2;
  const baselineOf = (top: number, pt: number): number => top + pt * MM_PER_PT * 0.92;

  const addPage = (kind: PageKind, opening = false): LayoutPage => {
    const page: LayoutPage = { index: pages.length + 1, kind, opening, items: [], images: [] };
    pages.push(page);
    return page;
  };

  const put = (
    page: LayoutPage,
    text: string,
    x: number,
    baseline: number,
    pt: number,
    style: TextStyle,
    align: TextAlign = "left",
    wordSpaceMm?: number
  ): void => {
    page.items.push({ text, x, y: baseline, sizePt: pt, style, align, wordSpaceMm });
  };

  const wrap = (text: string, width: number, style: TextStyle, pt: number): string[] => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return [];

    m.setFont(family, style);
    m.setFontSize(pt);
    return m.splitTextToSize(clean, width);
  };

  const centerLines = (
    page: LayoutPage,
    lines: string[],
    top: number,
    pt: number,
    style: TextStyle,
    factor: number
  ): number => {
    let cursor = top;

    for (const line of lines) {
      put(page, line, centerOf(page.index), baselineOf(cursor, pt), pt, style, "center");
      cursor += pt * MM_PER_PT * factor;
    }

    return cursor;
  };

  const leftLines = (
    page: LayoutPage,
    lines: string[],
    top: number,
    pt: number,
    style: TextStyle,
    factor: number
  ): number => {
    let cursor = top;

    for (const line of lines) {
      put(page, line, leftOf(page.index), baselineOf(cursor, pt), pt, style, "left");
      cursor += pt * MM_PER_PT * factor;
    }

    return cursor;
  };

  // ---- Pages liminaires -------------------------------------------------------------------------

  // Page 1 : faux-titre
  const page1 = addPage("fauxtitre");
  const fauxPt = round05(20 * scale);
  centerLines(page1, wrap(title, textWidth, "bold", fauxPt), H * 0.34, fauxPt, "bold", 1.25);

  // Page 2 : blanche
  addPage("blank");

  // Page 3 : page de titre
  const page3 = addPage("titre");
  let afterAuthor = 40 * scale;

  if (author) {
    const authorPt = round05(14 * scale);
    afterAuthor = centerLines(page3, wrap(author, textWidth, "normal", authorPt), afterAuthor, authorPt, "normal", 1.35);
  }

  const titlePt = round05(26 * scale);
  const titleTop = Math.max(afterAuthor + 20 * scale, H * 0.3);
  const afterTitle = centerLines(page3, wrap(title, textWidth, "bold", titlePt), titleTop, titlePt, "bold", 1.2);

  if (p.info.subtitle.trim()) {
    const subtitlePt = round05(14 * scale);
    centerLines(
      page3,
      wrap(p.info.subtitle, textWidth, "italic", subtitlePt),
      afterTitle + 6 * scale,
      subtitlePt,
      "italic",
      1.3
    );
  }

  if (p.logo) {
    let logoW = Math.min(textWidth * 0.7, 20 * scale * p.logo.aspect);
    const logoH = logoW / p.logo.aspect;
    logoW = logoH * p.logo.aspect;

    page3.images.push({
      dataUrl: p.logo.dataUrl,
      x: centerOf(3) - logoW / 2,
      y: H - 38 * scale - logoH,
      w: logoW,
      h: logoH,
    });
  } else {
    const brandPt = round05(13 * scale);
    put(page3, BRAND_NAME, centerOf(3), baselineOf(H - 48 * scale, brandPt), brandPt, "bold", "center");
  }

  if (year) {
    const yearPt = round05(10 * scale);
    put(page3, year, centerOf(3), baselineOf(H - 26 * scale, yearPt), yearPt, "normal", "center");
  }

  // Page 4 : copyright
  const page4 = addPage("copyright");
  let copyTop = H - 80 * scale;
  copyTop = leftLines(page4, [`© ${BRAND_NAME}${year ? `, ${year}` : ""}`], copyTop, 10, "bold", 1.5);
  copyTop = leftLines(page4, ["Tous droits réservés."], copyTop, 9, "normal", 1.5);
  copyTop = leftLines(
    page4,
    wrap(
      "Toute reproduction ou représentation, intégrale ou partielle, sans l'autorisation de l'éditeur est illicite.",
      textWidth,
      "normal",
      8.5
    ),
    copyTop + 2,
    8.5,
    "normal",
    1.45
  );
  if (p.info.isbnDisplay) {
    copyTop = leftLines(page4, [`ISBN : ${p.info.isbnDisplay}`], copyTop + 3, 9, "normal", 1.5);
  }
  if (year) {
    copyTop = leftLines(page4, [`Dépôt légal : ${year}`], copyTop, 9, "normal", 1.5);
  }
  leftLines(page4, [`Édité par ${BRAND_NAME}`], copyTop, 9, "normal", 1.5);

  // ---- Corps du livre ---------------------------------------------------------------------------

  let current: LayoutPage | null = null;
  let y = MARGINS.topMm;
  let afterHeading = true;

  const openBodyPage = (opening: boolean): LayoutPage => {
    const page = addPage("body", opening);
    current = page;
    y = MARGINS.topMm;
    return page;
  };

  const currentPage = (): LayoutPage => current ?? openBodyPage(false);

  // Un chapitre commence sur une page de droite (impaire) : on insère une page blanche si besoin.
  const padToRecto = (): void => {
    while ((pages.length + 1) % 2 === 0) {
      addPage("blank");
    }
  };

  const addChapter = (text: string): void => {
    if (o.chapterOnRecto) padToRecto();

    const page = openBodyPage(true);
    y = MARGINS.topMm + 30 * scale;

    const pt = round05(20 * scale);

    for (const line of wrap(text, textWidth, "bold", pt)) {
      put(page, line, centerOf(page.index), baselineOf(y, pt), pt, "bold", "center");
      y += pt * MM_PER_PT * 1.25;
    }

    y += 12 * scale;
    afterHeading = true;
  };

  const addSection = (text: string): void => {
    const pt = round05(bodyPt * 1.25);
    const lines = wrap(text, textWidth, "bold", pt);
    const lh = pt * MM_PER_PT * 1.3;
    const need = 6 + lines.length * lh + 3 + lineMm * 2;

    if (current !== null && y + need > bottomLimit) openBodyPage(false);

    const page = currentPage();
    if (y > MARGINS.topMm + 0.1) y += 6;

    for (const line of lines) {
      put(page, line, leftOf(page.index), baselineOf(y, pt), pt, "bold", "left");
      y += lh;
    }

    y += 3;
    afterHeading = true;
  };

  const addBreak = (): void => {
    if (current !== null && y + lineMm * 3 > bottomLimit) openBodyPage(false);

    const page = currentPage();
    y += lineMm * 0.6;
    put(page, "* * *", centerOf(page.index), baselineOf(y, bodyPt), bodyPt, "normal", "center");
    y += lineMm * 1.6;
    afterHeading = true;
  };

  const wrapParagraph = (text: string, indent: number): string[] => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return [];

    m.setFont(family, "normal");
    m.setFontSize(bodyPt);

    if (indent <= 0) return m.splitTextToSize(clean, textWidth);

    const first = m.splitTextToSize(clean, textWidth - indent)[0] ?? "";
    const consumed = first.split(" ").filter(Boolean).length;
    const rest = clean.split(" ").slice(consumed).join(" ");

    return rest ? [first, ...m.splitTextToSize(rest, textWidth)] : [first];
  };

  const addParagraph = (text: string): void => {
    const indent = afterHeading ? 0 : 5 * scale;
    const lines = wrapParagraph(text, indent);
    afterHeading = false;

    let index = 0;

    while (index < lines.length) {
      if (current === null) openBodyPage(false);

      const remaining = lines.length - index;
      const capacity = Math.floor((bottomLimit - y + 0.01) / lineMm);
      const atTop = y <= MARGINS.topMm + 0.01;
      let take = Math.min(Math.max(capacity, 0), remaining);

      // Pas de ligne isolée en bas de page (orpheline) ni en haut de page (veuve)
      if (take < remaining) {
        if (index === 0 && take < 2 && remaining >= 2) {
          take = 0;
        } else if (remaining - take === 1 && (take > 2 || index > 0)) {
          take -= 1;
        }
      }

      if (take <= 0) {
        if (atTop) {
          take = Math.max(1, Math.min(remaining, Math.max(capacity, 1)));
        } else {
          openBodyPage(false);
          continue;
        }
      }

      const page = currentPage();
      m.setFont(family, "normal");
      m.setFontSize(bodyPt);

      for (let step = 0; step < take; step += 1) {
        const lineNo = index + step;
        const first = lineNo === 0;
        const last = lineNo === lines.length - 1;
        const x = leftOf(page.index) + (first ? indent : 0);
        const available = textWidth - (first ? indent : 0);
        const lineText = lines[lineNo];

        let wordSpace: number | undefined;

        if (o.justify && !last) {
          const spaces = lineText.split(" ").length - 1;
          const extra = spaces > 0 ? (available - m.getTextWidth(lineText)) / spaces : 0;
          if (spaces > 0 && extra > 0.02 && extra < 3) wordSpace = extra;
        }

        put(page, lineText, x, baselineOf(y, bodyPt), bodyPt, "normal", "left", wordSpace);
        y += lineMm;
      }

      index += take;
      if (index < lines.length) openBodyPage(false);
    }
  };

  for (const block of p.blocks) {
    if (block.type === "chapter") addChapter(block.text);
    else if (block.type === "section") addSection(block.text);
    else if (block.type === "break") addBreak();
    else addParagraph(block.text);
  }

  // Numéros de page (sauf pages blanches et premières pages de chapitre)
  const folioPt = 9.5;
  for (const page of pages) {
    if (page.kind === "body" && !page.opening) {
      const number = o.restartNumbering ? page.index - FRONT_MATTER_PAGES : page.index;
      put(page, String(number), centerOf(page.index), H - 9, folioPt, "normal", "center");
    }
  }

  // ---- Fin du livre : pages blanches pour un multiple de 4, achevé d'imprimer ------------------

  const contentPages = pages.length;
  const withColophon = contentPages + 1;
  const paddingCount = (4 - (withColophon % 4)) % 4;

  const addColophon = (): void => {
    const page = addPage("colophon");
    const pt = round05(11 * scale);
    let top = H * 0.55;

    top = centerLines(
      page,
      wrap("Achevé d'imprimer par techlibrairie Edition", textWidth, "bold", pt),
      top,
      pt,
      "bold",
      1.4
    );

    const smallPt = round05(9 * scale);
    if (year) {
      top = centerLines(page, [`Dépôt légal : ${year}`], top + 2, smallPt, "normal", 1.5);
    }
    if (p.info.isbnDisplay) {
      centerLines(page, [`ISBN : ${p.info.isbnDisplay}`], top, smallPt, "normal", 1.5);
    }
  };

  if (o.colophonLast) {
    for (let index = 0; index < paddingCount; index += 1) addPage("padding");
    addColophon();
  } else {
    addColophon();
    for (let index = 0; index < paddingCount; index += 1) addPage("padding");
  }

  const total = pages.length;

  return {
    pages,
    totalPages: total,
    bodyPages: contentPages - FRONT_MATTER_PAGES,
    paddingPages: paddingCount,
    missingForMinimum: Math.max(0, MIN_PAGES_PERFECT_BOUND - total),
    trimWidthMm: W,
    trimHeightMm: H,
    fontFamily: family,
  };
  }
