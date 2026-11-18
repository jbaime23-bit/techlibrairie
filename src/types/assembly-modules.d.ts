// src/types/assembly-modules.d.ts
// Déclarations de types pour deux bibliothèques du module d'assemblage éditeur
// (jsbarcode et la version navigateur de mammoth). Ce fichier ne contient ni import ni export.

declare module "jsbarcode" {
  interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    font?: string;
    textMargin?: number;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    background?: string;
    lineColor?: string;
    flat?: boolean;
  }

  function JsBarcode(
    target: HTMLCanvasElement | SVGElement | HTMLImageElement | string,
    text: string,
    options?: JsBarcodeOptions
  ): void;

  export default JsBarcode;
}

declare module "mammoth/mammoth.browser" {
  interface MammothMessage {
    type: string;
    message: string;
  }

  interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  interface MammothApi {
    convertToHtml(
      input: { arrayBuffer: ArrayBuffer },
      options?: Record<string, unknown>
    ): Promise<MammothResult>;
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<MammothResult>;
  }

  const mammoth: MammothApi;
  export default mammoth;
}
