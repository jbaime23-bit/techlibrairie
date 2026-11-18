// src/lib/assembly/image-utils.ts
// Images côté navigateur : chargement, lecture de fichier, recadrage et couleurs.

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image illisible."));
    image.src = src;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Lecture du fichier impossible."));
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { r: 0, g: 0, b: 0 };

  const value = parseInt(full, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Luminosité perçue, de 0 (noir) à 1 (blanc). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Lit une image importée, la réduit si elle est très grande (mémoire du téléphone) et l'aplatit en JPEG. */
export async function prepareImageFile(file: File, maxPx = 3200): Promise<PreparedImage> {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);

  const scale = Math.min(1, maxPx / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas traiter l'image.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), width, height };
}

/** Recadre une image pour remplir exactement un cadre (centré), et renvoie un JPEG. */
export async function cropImageToCover(
  src: string,
  targetWidth: number,
  targetHeight: number,
  background: string,
  maxPx = 2800
): Promise<string> {
  const image = await loadImage(src);
  const ratio = targetWidth / targetHeight;

  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  let sx = 0;
  let sy = 0;

  if (sw / sh > ratio) {
    const newWidth = sh * ratio;
    sx = (sw - newWidth) / 2;
    sw = newWidth;
  } else {
    const newHeight = sw / ratio;
    sy = (sh - newHeight) / 2;
    sh = newHeight;
  }

  const scale = Math.min(1, maxPx / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas traiter l'image.");

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", 0.92);
  }
