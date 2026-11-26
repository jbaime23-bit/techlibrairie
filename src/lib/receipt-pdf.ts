// src/lib/receipt-pdf.ts
// Génération côté serveur des documents comptables en PDF (jsPDF) : reçu de paiement du forfait d'édition et
// facture d'une commande d'exemplaires imprimés. Les informations de l'exploitant viennent de la configuration
// légale ; une information absente est simplement omise.

import { jsPDF } from "jspdf";
import type { LegalConfig } from "@/lib/legal-config";
import { sanitizeText } from "@/lib/assembly/text-utils";

export interface DocumentLine {
  label: string;
  quantity: number;
  unitXof: number;
  totalXof: number;
}

export interface DocumentInput {
  title: "Reçu de paiement" | "Facture";
  number: string;
  issuedOn: string;
  issuer: LegalConfig;
  client: { name: string; lines: string[] };
  lines: DocumentLine[];
  totalXof: number;
  payment: { label: string; reference: string | null; paidOn: string | null };
  notes: string[];
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const TEXT_W = PAGE_W - 2 * MARGIN;
const BOTTOM = PAGE_H - 22;
const MM_PER_PT = 25.4 / 72;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatFrenchDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function clean(value: string): string {
  return sanitizeText(value).text.replace(/\s+/g, " ").trim();
}

function amount(value: number): string {
  return clean(`${value.toLocaleString("fr-FR")} FCFA`);
}

export function renderDocumentPdf(input: DocumentInput): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  let y = MARGIN;

  doc.setProperties({
    title: `${input.title} ${input.number}`,
    subject: input.number,
    creator: "TechLibrairie Édition",
  });

  const ensure = (height: number): void => {
    if (y + height > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const write = (
    text: string,
    size: number,
    style: "normal" | "bold" | "italic",
    options: {
      x?: number;
      width?: number;
      gap?: number;
      color?: [number, number, number];
      align?: "left" | "right";
    } = {}
  ): void => {
    const color = options.color ?? [0, 0, 0];
    doc.setFont("times", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(clean(text), options.width ?? TEXT_W) as string[];
    const lineHeight = size * MM_PER_PT * 1.4;

    for (const line of lines) {
      ensure(lineHeight);
      doc.text(line, options.x ?? MARGIN, y + size * MM_PER_PT, { align: options.align ?? "left" });
      y += lineHeight;
    }

    y += options.gap ?? 1.5;
  };

  // En-tête
  write("TechLibrairie Édition", 9, "bold", { gap: 1, color: [67, 56, 202] });
  doc.setDrawColor(199, 210, 254);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  write(input.title, 20, "bold", { gap: 1 });
  write(`N° ${input.number} · Émis le ${input.issuedOn}`, 10.5, "normal", { gap: 6, color: [90, 90, 90] });

  // Émetteur et client, côte à côte
  const columnTop = y;
  const columnWidth = TEXT_W / 2 - 4;

  write("Émetteur", 9, "bold", { width: columnWidth, gap: 1, color: [67, 56, 202] });
  write(input.issuer.name ?? "TechLibrairie Édition", 11, "bold", { width: columnWidth, gap: 0.5 });
  if (input.issuer.address) write(input.issuer.address, 10, "normal", { width: columnWidth, gap: 0.5 });
  if (input.issuer.registration) {
    write(`Immatriculation : ${input.issuer.registration}`, 10, "normal", { width: columnWidth, gap: 0.5 });
  }
  write(input.issuer.country, 10, "normal", { width: columnWidth, gap: 0 });
  const issuerBottom = y;

  y = columnTop;
  const clientX = MARGIN + TEXT_W / 2 + 4;

  write("Client", 9, "bold", { x: clientX, width: columnWidth, gap: 1, color: [67, 56, 202] });
  write(input.client.name, 11, "bold", { x: clientX, width: columnWidth, gap: 0.5 });
  for (const line of input.client.lines) {
    write(line, 10, "normal", { x: clientX, width: columnWidth, gap: 0.5 });
  }

  y = Math.max(issuerBottom, y) + 7;

  // Tableau des lignes
  const colQty = MARGIN + 108;
  const colUnit = MARGIN + 145;
  const rowHeight = 6.2;

  doc.setFillColor(238, 242, 255);
  doc.rect(MARGIN, y, TEXT_W, rowHeight + 0.8, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 27, 75);
  doc.text("Désignation", MARGIN + 2, y + 4.6);
  doc.text("Qté", colQty, y + 4.6, { align: "right" });
  doc.text("Prix unitaire", colUnit, y + 4.6, { align: "right" });
  doc.text("Total", PAGE_W - MARGIN - 2, y + 4.6, { align: "right" });
  y += rowHeight + 2;

  for (const line of input.lines) {
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);

    const labelLines = doc.splitTextToSize(clean(line.label), 98) as string[];
    const height = Math.max(rowHeight, labelLines.length * 4.9 + 1.5);
    ensure(height);

    labelLines.forEach((labelLine, index) => {
      doc.text(labelLine, MARGIN + 2, y + 4.4 + index * 4.9);
    });
    doc.text(String(line.quantity), colQty, y + 4.4, { align: "right" });
    doc.text(amount(line.unitXof), colUnit, y + 4.4, { align: "right" });
    doc.text(amount(line.totalXof), PAGE_W - MARGIN - 2, y + 4.4, { align: "right" });

    y += height;
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 1;
  }

  // Total
  ensure(24);
  y += 3;
  doc.setFillColor(238, 242, 255);
  doc.rect(PAGE_W - MARGIN - 78, y, 78, 9, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 27, 75);
  doc.text("Total payé", PAGE_W - MARGIN - 75, y + 6.2);
  doc.text(amount(input.totalXof), PAGE_W - MARGIN - 2, y + 6.2, { align: "right" });
  y += 15;

  // Paiement
  write("Paiement", 11, "bold", { gap: 1 });
  write(`Moyen de paiement : ${input.payment.label}`, 10.5, "normal", { gap: 0.5 });
  if (input.payment.reference) {
    write(`Référence de la transaction : ${input.payment.reference}`, 10.5, "normal", { gap: 0.5 });
  }
  if (input.payment.paidOn) {
    write(`Paiement validé le ${input.payment.paidOn}`, 10.5, "normal", { gap: 4 });
  } else {
    y += 3;
  }

  // Mentions
  for (const note of input.notes) {
    write(note, 9.5, "italic", { gap: 1.5, color: [75, 85, 99] });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("times", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`${clean(input.issuer.name ?? "TechLibrairie Édition")} · ${input.number}`, MARGIN, PAGE_H - 12);
    doc.text(`Page ${page} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 12, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
