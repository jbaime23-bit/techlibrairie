// src/lib/assembly/text-utils.ts
// Nettoyage des textes pour les polices standard des PDF (alphabet latin : français et anglais).

// Caractères hors latin-1 pris en charge par l'encodage WinAnsi des polices standard
const EXTRA_ALLOWED = new Set<string>([
  "œ", "Œ", "š", "Š", "ž", "Ž", "Ÿ", "ƒ", "ˆ", "˜", "–", "—", "‘", "’", "‚", "“", "”", "„",
  "†", "‡", "•", "…", "‰", "‹", "›", "€", "™",
]);

export interface SanitizedText {
  text: string;
  // Nombre de caractères non pris en charge, remplacés par « ? »
  replaced: number;
}

export function sanitizeText(input: string): SanitizedText {
  let replaced = 0;
  let out = "";

  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;

    if (ch === "\n") {
      out += ch;
    } else if (ch === "\r") {
      continue;
    } else if (ch === "\t") {
      out += "    ";
    } else if (code === 0x202f) {
      out += "\u00a0";
    } else if (
      code === 0x2002 ||
      code === 0x2003 ||
      code === 0x2005 ||
      code === 0x2006 ||
      code === 0x2009 ||
      code === 0x200a ||
      code === 0x3000
    ) {
      out += " ";
    } else if (
      code === 0x200b ||
      code === 0x200c ||
      code === 0x200d ||
      code === 0xfeff ||
      code === 0x00ad
    ) {
      continue;
    } else if (code === 0x2212) {
      out += "-";
    } else if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
      out += " ";
    } else if (code <= 0xff || EXTRA_ALLOWED.has(ch)) {
      out += ch;
    } else {
      out += "?";
      replaced += 1;
    }
  }

  return { text: out, replaced };
}

/** Texte d'une seule ligne : nettoyé, espaces multiples réduits (l'espace insécable est conservée). */
export function singleLine(value: string): string {
  return sanitizeText(value).text.replace(/[ \t\r\n]+/g, " ").trim();
}

/** Texte de plusieurs lignes : nettoyé, chaque ligne nettoyée, lignes vides retirées en tête et en queue. */
export function multiLine(value: string): string {
  return sanitizeText(value)
    .text.split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
               }
