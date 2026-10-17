// src/lib/csv.ts
// Outils d'export CSV : échappement (avec protection contre l'injection de formules),
// fichier lisible directement par Excel en français (UTF-8 avec BOM, séparateur point-virgule),
// validation des périodes.

export type Cell = string | number | null;

export const MAX_EXPORT_ROWS = 20_000;
export const MAX_EXPORT_DAYS = 366;

const BOM = "\uFEFF";
const SEPARATOR = ";";

/**
 * Neutralise une cellule texte qui pourrait être interprétée comme une formule
 * par un tableur (=, +, -, @, tabulation, retour chariot en début de cellule).
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(cell: Cell): string {
  if (cell === null) return "";

  if (typeof cell === "number") {
    return Number.isFinite(cell) ? String(cell) : "";
  }

  const safe = neutralizeFormula(cell.replace(/\u0000/g, ""));

  if (/[";\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** Construit le contenu d'un fichier CSV (UTF-8 avec BOM, lignes séparées par CRLF). */
export function buildCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => csvCell(cell)).join(SEPARATOR)
  );
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

/** Réponse HTTP de téléchargement d'un fichier CSV. */
export function csvResponse(content: string, fileName: string): Response {
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Date et heure UTC lisibles par un tableur, ex. "2026-10-12 08:30". */
export function formatCsvDateTime(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Montant pour un tableur : nombre entier pour le FCFA ; pour l'euro et le dollar
 * (stockés en centimes), texte avec virgule décimale, ex. "12,50".
 */
export function moneyCell(amount: number, currency: string): Cell {
  if (currency === "XOF") return amount;
  return (amount / 100).toFixed(2).replace(".", ",");
}

/** Pourcentage depuis des points de base, ex. 1000 donne "10" et 250 donne "2,5". */
export function percentCell(basisPoints: number): string {
  return String(basisPoints / 100).replace(".", ",");
}

export interface DateRange {
  start: Date;
  end: Date;
  from: string;
  to: string;
}

export type DateRangeError = "dates" | "ordre" | "periode";

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  // Rejette les dates impossibles (ex. 2026-02-31).
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** Valide une période AAAA-MM-JJ à AAAA-MM-JJ (bornes incluses, heure UTC). */
export function parseDateRange(
  fromRaw: string | null,
  toRaw: string | null
): { ok: true; range: DateRange } | { ok: false; error: DateRangeError } {
  const start = parseDay(fromRaw);
  const endDay = parseDay(toRaw);

  if (!start || !endDay || !fromRaw || !toRaw) {
    return { ok: false, error: "dates" };
  }

  if (endDay.getTime() < start.getTime()) {
    return { ok: false, error: "ordre" };
  }

  const days = Math.round((endDay.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_EXPORT_DAYS) {
    return { ok: false, error: "periode" };
  }

  const end = new Date(`${toRaw}T23:59:59.999Z`);

  return { ok: true, range: { start, end, from: fromRaw, to: toRaw } };
}

/** Périodes proposées en raccourci sur les pages d'export. */
export function quickPeriods(
  now: Date = new Date()
): { label: string; from: string; to: string }[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  return [
    { label: "Ce mois-ci", from: iso(new Date(Date.UTC(year, month, 1))), to: iso(now) },
    {
      label: "Mois dernier",
      from: iso(new Date(Date.UTC(year, month - 1, 1))),
      to: iso(new Date(Date.UTC(year, month, 0))),
    },
    { label: "Cette année", from: `${year}-01-01`, to: iso(now) },
    { label: "Année dernière", from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
  ];
      }
