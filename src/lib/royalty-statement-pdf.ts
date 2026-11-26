// src/lib/royalty-statement-pdf.ts
// Génération côté serveur du relevé annuel des droits d'auteur (article 9 du contrat d'édition à compte d'éditeur).

import { jsPDF } from "jspdf";
import type { RoyaltyLine } from "@/lib/royalties";
import { sanitizeText } from "@/lib/assembly/text-utils";

export interface StatementInput {
  reference: string;
  authorName: string;
  // Exemple : « Année 2026 » ou « du 1er janvier au 23 novembre 2026 (état provisoire) »
  periodLabel: string;
  generatedOn: string;
  lines: RoyaltyLine[];
  totalXof: number;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const TEXT_W = PAGE_W - 2 * MARGIN;
const BOTTOM = PAGE_H - 22;
const MM_PER_PT = 25.4 / 72;

function clean(value: string): string {
  return sanitizeText(value).text.replace(/\s+/g, " ").trim();
}

function amount(value: number): string {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function count(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function renderRoyaltyStatementPdf(input: StatementInput): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  let y = MARGIN;

  doc.setProperties({
    title: "État des droits d'auteur",
    subject: input.reference,
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
    options: { x?: number; gap?: number; color?: [number, number, number]; align?: "left" | "right"; width?: number } = {}
  ): void => {
    const color = options.color ?? [0, 0, 0];
    doc.setFont("times", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);

    const x = options.x ?? MARGIN;
    const lines = doc.splitTextToSize(clean(text), options.width ?? TEXT_W) as string[];
    const lineHeight = size * MM_PER_PT * 1.4;

    for (const line of lines) {
      ensure(lineHeight);
      doc.text(line, x, y + size * MM_PER_PT, { align: options.align ?? "left" });
      y += lineHeight;
    }

    y += options.gap ?? 1.5;
  };

  const row = (label: string, copies: string, gross: string, royalty: string, bold: boolean): void => {
    const style = bold ? "bold" : "normal";
    const lineHeight = 5.4;
    ensure(lineHeight);

    doc.setFont("times", style);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const top = y + 3.8;
    doc.text(clean(label), MARGIN, top);
    doc.text(copies, MARGIN + 92, top, { align: "right" });
    doc.text(clean(gross), MARGIN + 131, top, { align: "right" });
    doc.text(clean(royalty), PAGE_W - MARGIN, top, { align: "right" });

    y += lineHeight;
  };

  // En-tête
  write("TechLibrairie Édition", 9, "bold", { gap: 1, color: [67, 56, 202] });
  doc.setDrawColor(199, 210, 254);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  write("État des droits d'auteur", 17, "bold", { gap: 2 });
  write(`Auteur : ${input.authorName}`, 11, "normal", { gap: 0.5 });
  write(`Période : ${input.periodLabel}`, 11, "normal", { gap: 0.5 });
  write(`Établi le ${input.generatedOn} · Référence ${input.reference}`, 9.5, "normal", {
    gap: 4,
    color: [90, 90, 90],
  });

  write(
    "Cet état est établi conformément à l'article 9 du contrat d'édition à compte d'éditeur. Les droits sont calculés sur le prix public hors taxes de chaque exemplaire vendu et payé, livraison exclue, après déduction des exemplaires remboursés.",
    9.5,
    "italic",
    { gap: 5, color: [75, 85, 99] }
  );

  if (input.lines.length === 0) {
    write("Aucun livre n'est lié à un contrat d'édition pour cette période.", 11, "normal");
  }

  for (const line of input.lines) {
    ensure(34);

    write(`${line.title}  (taux : ${line.percent} %)`, 12, "bold", { gap: 1.5 });

    doc.setDrawColor(150, 150, 150);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 1;

    row("Format", "Exemplaires", "Ventes HT", "Droits", true);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 1;

    row("Livre numérique (PDF)", count(line.digitalCopies), amount(line.digitalGrossXof), amount(line.digitalRoyaltyXof), false);
    row("Livre imprimé à la demande", count(line.printCopies), amount(line.printGrossXof), amount(line.printRoyaltyXof), false);

    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 1;
    row(
      "Total du livre",
      count(line.digitalCopies + line.printCopies),
      amount(line.digitalGrossXof + line.printGrossXof),
      amount(line.earnedXof),
      true
    );
    y += 5;
  }

  ensure(22);
  doc.setDrawColor(60, 60, 60);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 3;
  write(`Total des droits d'auteur acquis sur la période : ${amount(input.totalXof)}`, 12, "bold", { gap: 4 });

  write(
    "Les droits acquis s'ajoutent à votre solde dans « Mes revenus » : vous en demandez le versement par Mobile Money depuis votre espace, après le délai de sécurité et au-dessus du montant minimum indiqués dans les conditions de la plateforme.",
    9.5,
    "normal",
    { gap: 2, color: [75, 85, 99] }
  );
  write(
    "Pour toute contestation de cet état, écrivez-nous par le formulaire de contact du site : l'Éditeur vous communique les justifications demandées.",
    9.5,
    "normal",
    { gap: 0, color: [75, 85, 99] }
  );

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("times", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`TechLibrairie Édition · ${input.reference}`, MARGIN, PAGE_H - 12);
    doc.text(`Page ${page} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 12, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
  }
