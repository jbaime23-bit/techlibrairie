// src/lib/assembly/pdf-export.ts
// Génération des deux PDF avec jsPDF, entièrement dans le navigateur :
// le corps du livre (aux dimensions exactes du format) et la couverture complète à plat.

import { BRAND_NAME, type FontFamily } from "@/lib/assembly/constants";
import { cropImageToCover, hexToRgb } from "@/lib/assembly/image-utils";
import type { InteriorLayout, TextMeasurer } from "@/lib/assembly/interior-layout";
import type { CoverScene } from "@/lib/assembly/cover-scene";

export interface PdfDoc {
  addPage(): unknown;
  setFont(fontName: string, fontStyle?: string): unknown;
  setFontSize(size: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  setFillColor(r: number, g: number, b: number): unknown;
  text(text: string, x: number, y: number, options?: { align?: "left" | "center" | "right"; angle?: number }): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown;
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): unknown;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): unknown;
  setProperties(properties: Record<string, string>): unknown;
  save(filename: string): unknown;
  output(type: "blob"): Blob;
  internal: { write?: (...parts: string[]) => void; scaleFactor?: number };
}

export interface PdfOptions {
  orientation?: "portrait" | "landscape";
  unit?: "mm";
  format?: number[];
  compress?: boolean;
}

export type PdfCtor = new (options: PdfOptions) => PdfDoc;

interface GStateHost {
  GState?: new (parameters: { opacity: number }) => unknown;
  setGState?: (state: unknown) => unknown;
}

/** Mesure de texte (polices standard de jsPDF, en millimètres) pour la mise en page. */
export function createMeasurer(ctor: PdfCtor): TextMeasurer {
  const doc = new ctor({ unit: "mm", format: [100, 100], compress: false });
  return doc as unknown as TextMeasurer;
}

function setWordSpace(doc: PdfDoc, mm: number): void {
  const write = doc.internal.write;
  if (typeof write !== "function") return;

  const factor = doc.internal.scaleFactor ?? 72 / 25.4;
  write.call(doc.internal, `${(mm * factor).toFixed(3)} Tw`);
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export interface InteriorPdfMeta {
  title: string;
  author: string;
}

/** PDF du corps du livre : une page de document par page du modèle de mise en page. */
export async function renderInteriorPdf(
  ctor: PdfCtor,
  layout: InteriorLayout,
  meta: InteriorPdfMeta
): Promise<PdfDoc> {
  const doc = new ctor({
    orientation: "portrait",
    unit: "mm",
    format: [layout.trimWidthMm, layout.trimHeightMm],
    compress: true,
  });

  doc.setProperties({
    title: meta.title || "Livre",
    author: meta.author,
    subject: "Corps du livre",
    creator: BRAND_NAME,
  });

  for (let position = 0; position < layout.pages.length; position += 1) {
    const page = layout.pages[position];

    if (position > 0) doc.addPage();

    for (const item of page.items) {
      doc.setFont(layout.fontFamily, item.style);
      doc.setFontSize(item.sizePt);
      doc.setTextColor(0, 0, 0);

      if (item.wordSpaceMm) setWordSpace(doc, item.wordSpaceMm);
      doc.text(item.text, item.x, item.y, { align: item.align });
      if (item.wordSpaceMm) setWordSpace(doc, 0);
    }

    for (const image of page.images) {
      doc.addImage(image.dataUrl, "PNG", image.x, image.y, image.w, image.h);
    }

    if (position % 25 === 24) await yieldToBrowser();
  }

  return doc;
}

export interface CoverPdfMeta {
  title: string;
  author: string;
}

/** PDF de la couverture complète à plat, fonds perdus compris. */
export async function renderCoverPdf(
  ctor: PdfCtor,
  scene: CoverScene,
  meta: CoverPdfMeta
): Promise<PdfDoc> {
  const doc = new ctor({
    orientation: scene.widthMm >= scene.heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [scene.widthMm, scene.heightMm],
    compress: true,
  });

  doc.setProperties({
    title: `${meta.title || "Livre"} (couverture)`,
    author: meta.author,
    subject: "Couverture complète à plat",
    creator: BRAND_NAME,
  });

  const host = doc as unknown as GStateHost;

  for (const item of scene.items) {
    if (item.kind === "rect") {
      const { r, g, b } = hexToRgb(item.fill);
      const translucent = item.opacity !== undefined && item.opacity < 1 && host.GState && host.setGState;

      if (translucent && host.GState && host.setGState) {
        host.setGState(new host.GState({ opacity: item.opacity ?? 1 }));
      }

      doc.setFillColor(r, g, b);

      if (item.radius) {
        doc.roundedRect(item.x, item.y, item.w, item.h, item.radius, item.radius, "F");
      } else {
        doc.rect(item.x, item.y, item.w, item.h, "F");
      }

      if (translucent && host.GState && host.setGState) {
        host.setGState(new host.GState({ opacity: 1 }));
      }
    } else if (item.kind === "image") {
      if (item.fit === "cover") {
        const cropped = await cropImageToCover(item.src, item.w, item.h, scene.bgColor);
        doc.addImage(cropped, "JPEG", item.x, item.y, item.w, item.h);
      } else {
        doc.addImage(item.src, item.format, item.x, item.y, item.w, item.h);
      }
    } else {
      const { r, g, b } = hexToRgb(item.color);
      const family: FontFamily = item.family;

      doc.setFont(family, item.style);
      doc.setFontSize(item.sizePt);
      doc.setTextColor(r, g, b);

      if (item.rotate === 90) {
        doc.text(item.text, item.x, item.y, { angle: -90 });
      } else {
        doc.text(item.text, item.x, item.y, { align: item.align });
      }
    }
  }

  return doc;
        }
