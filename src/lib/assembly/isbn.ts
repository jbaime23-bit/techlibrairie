// src/lib/assembly/isbn.ts
// Validation d'un ISBN-13 : 13 chiffres, préfixe 978 ou 979 et clé de contrôle exacte.

export type IsbnState = "empty" | "invalid" | "valid";

export interface IsbnStatus {
  state: IsbnState;
  // Les 13 chiffres (vide si la saisie est inexploitable)
  digits: string;
  // Forme à afficher dans le livre (avec les tirets saisis, ou les 13 chiffres)
  display: string | null;
  message: string | null;
  expectedCheckDigit: number | null;
}

export function isbn13CheckDigit(first12: string): number {
  let sum = 0;

  for (let index = 0; index < 12; index += 1) {
    sum += Number(first12[index]) * (index % 2 === 0 ? 1 : 3);
  }

  return (10 - (sum % 10)) % 10;
}

export function analyseIsbn13(raw: string): IsbnStatus {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { state: "empty", digits: "", display: null, message: null, expectedCheckDigit: null };
  }

  const cleaned = trimmed.replace(/^isbn(?:-13)?\s*:?\s*/i, "");

  if (/[^0-9\s-]/.test(cleaned)) {
    return {
      state: "invalid",
      digits: "",
      display: null,
      message: "Un ISBN-13 ne contient que des chiffres (les tirets et les espaces sont acceptés).",
      expectedCheckDigit: null,
    };
  }

  const digits = cleaned.replace(/[\s-]/g, "");

  if (digits.length !== 13) {
    return {
      state: "invalid",
      digits,
      display: null,
      message: `L'ISBN-13 doit contenir exactement 13 chiffres (vous en avez saisi ${digits.length}).`,
      expectedCheckDigit: null,
    };
  }

  if (!digits.startsWith("978") && !digits.startsWith("979")) {
    return {
      state: "invalid",
      digits,
      display: null,
      message: "Un ISBN-13 commence par 978 ou 979.",
      expectedCheckDigit: null,
    };
  }

  const expected = isbn13CheckDigit(digits.slice(0, 12));

  if (expected !== Number(digits[12])) {
    return {
      state: "invalid",
      digits,
      display: null,
      message: `La clé de contrôle est incorrecte : le dernier chiffre devrait être ${expected}.`,
      expectedCheckDigit: expected,
    };
  }

  const display = /[\s-]/.test(cleaned) ? cleaned.replace(/\s+/g, " ").trim() : digits;

  return { state: "valid", digits, display, message: null, expectedCheckDigit: expected };
      }
