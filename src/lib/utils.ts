// src/lib/utils.ts
// Fonctions utilitaires partagées.

import { randomBytes } from "crypto";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Currency } from "@prisma/client";

/** Fusionne des classes Tailwind sans conflit. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Facteur de conversion entre l'unité stockée en base et l'unité affichée.
 * XOF : le franc CFA n'a pas de centimes (1 = 1 franc).
 * EUR / USD : les montants sont stockés en centimes (100 = 1 unité).
 */
export const CURRENCY_FACTOR: Record<Currency, number> = {
  XOF: 1,
  EUR: 100,
  USD: 100,
};

/** Formate un montant stocké en base (ex. 5000 XOF => "5 000 F CFA"). */
export function formatPrice(
  amount: number,
  currency: Currency,
  locale: string = "fr-FR"
): string {
  const factor = CURRENCY_FACTOR[currency];
  const digits = factor === 1 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / factor);
}

/** Convertit un montant saisi par l'utilisateur en unité de stockage. */
export function toStoredAmount(displayAmount: number, currency: Currency): number {
  return Math.round(displayAmount * CURRENCY_FACTOR[currency]);
}

/** Transforme un texte en slug d'URL (sans accents, en minuscules). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Slug unique : le titre slugifié + un suffixe aléatoire. */
export function slugWithSuffix(input: string): string {
  const base = slugify(input) || "produit";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Numéro de commande lisible, ex. TL-20261011-A1B2C3. */
export function generateOrderNumber(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear().toString();
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `TL-${yyyy}${mm}${dd}-${suffix}`;
}

/** Jeton de téléchargement imprévisible (256 bits). */
export function generateDownloadToken(): string {
  return randomBytes(32).toString("hex");
}

/** Taille de fichier lisible, ex. 2.4 Mo. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} Ko`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} Mo`;
  return `${(mb / 1024).toFixed(2)} Go`;
}

/** Date lisible en français. */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
                    }
