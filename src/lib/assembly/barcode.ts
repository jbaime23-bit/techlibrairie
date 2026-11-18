// src/lib/assembly/barcode.ts
// Code-barres EAN-13 d'un ISBN-13 (bibliothèque jsbarcode), en PNG haute résolution et en SVG.

export interface BarcodeResult {
  pngDataUrl: string;
  // Dimensions du PNG, en pixels
  width: number;
  height: number;
  svg: string;
}

// 6 pixels par module : environ 390 points par pouce une fois placé à 100 % (37,29 mm).
const OPTIONS = {
  format: "EAN13",
  width: 6,
  height: 160,
  displayValue: true,
  fontSize: 44,
  textMargin: 8,
  marginLeft: 72,
  marginRight: 72,
  marginTop: 24,
  marginBottom: 24,
  background: "#ffffff",
  lineColor: "#000000",
};

type BarcodeFunction = (
  target: HTMLCanvasElement | SVGElement,
  text: string,
  options?: typeof OPTIONS
) => void;

export async function generateBarcode(isbn13: string): Promise<BarcodeResult> {
  const mod = (await import("jsbarcode")) as unknown as { default?: BarcodeFunction } & BarcodeFunction;
  const draw: BarcodeFunction = typeof mod.default === "function" ? mod.default : mod;

  const canvas = document.createElement("canvas");
  draw(canvas, isbn13, OPTIONS);

  const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  draw(svgElement, isbn13, OPTIONS);

  return {
    pngDataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    svg: new XMLSerializer().serializeToString(svgElement),
  };
}
