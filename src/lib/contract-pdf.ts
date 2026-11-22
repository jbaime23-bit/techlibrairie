// src/lib/contract-pdf.ts
// Génération côté serveur du PDF d'un contrat (jsPDF) : le texte archivé, tel qu'accepté, avec un bloc de
// signature électronique (signé) ou la mention « projet non signé ».

import { jsPDF } from "jspdf";
import { parseContractText } from "@/lib/contract-text";
import { sanitizeText } from "@/lib/assembly/text-utils";

export interface ContractPdfInput {
  reference: string;
  // Texte intégral archivé du contrat
  plainText: string;
  // Empreinte SHA-256 du texte
  hash: string;
  // Signature en ligne : absente tant que le contrat n'est pas signé
  signature: { name: string; email: string; acceptedAt: Date } | null;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const TEXT_W = PAGE_W - 2 * MARGIN;
const BOTTOM = PAGE_H - 22;
const MM_PER_PT = 25.4 / 72;

function clean(value: string): string {
  return sanitizeText(value).text.replace(/\s+/g, " ").trim();
}

function formatDateTime(date: Date): string {
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`;
}

export function renderContractPdf(input: ContractPdfInput): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const parsed = parseContractText(input.plainText);
  let y = MARGIN;

  doc.setProperties({
    title: clean(parsed.title),
    subject: `Contrat ${input.reference}`,
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
    options: { center?: boolean; gap?: number; color?: [number, number, number] } = {}
  ): void => {
    const color = options.color ?? [0, 0, 0];
    doc.setFont("times", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(clean(text), TEXT_W) as string[];
    const lineHeight = size * MM_PER_PT * 1.38;

    for (const line of lines) {
      ensure(lineHeight);

      if (options.center) {
        doc.text(line, PAGE_W / 2, y + size * MM_PER_PT, { align: "center" });
      } else {
        doc.text(line, MARGIN, y + size * MM_PER_PT);
      }

      y += lineHeight;
    }

    y += options.gap ?? 2;
  };

  // En-tête
  write("TechLibrairie Édition", 9, "bold", { center: true, gap: 1, color: [67, 56, 202] });
  doc.setDrawColor(199, 210, 254);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  write(parsed.title, 16, "bold", { center: true, gap: 2 });
  write(parsed.subtitle, 10, "italic", { center: true, gap: 3, color: [75, 85, 99] });
  write(`Référence : ${input.reference}`, 9, "normal", { center: true, gap: 4, color: [75, 85, 99] });

  if (!input.signature) {
    write(
      "PROJET : ce contrat n'est pas encore signé. Il sera signé en ligne depuis votre espace auteur.",
      9.5,
      "bold",
      { center: true, gap: 4, color: [180, 83, 9] }
    );
  }

  // Parties
  for (const party of parsed.parties) {
    write(party, 10.5, "normal", { gap: 2.5 });
  }
  y += 2;

  // Articles et annexes
  for (const section of parsed.sections) {
    ensure(14);
    y += 2;
    write(section.heading, 11.5, "bold", { gap: 1.5 });

    for (const paragraph of section.paragraphs) {
      write(paragraph, 10.5, "normal", { gap: 2 });
    }
  }

  // Signature électronique
  ensure(46);
  y += 4;
  doc.setDrawColor(120, 120, 120);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  write("Signature électronique", 11.5, "bold", { gap: 2 });

  if (input.signature) {
    write(
      `Contrat accepté en ligne le ${formatDateTime(input.signature.acceptedAt)} par ${input.signature.name} (${input.signature.email}). La saisie du nom et la case d'acceptation valent signature.`,
      10,
      "normal",
      { gap: 2 }
    );
  } else {
    write(
      "À signer en ligne : lisez le contrat dans votre espace auteur, cochez la case d'acceptation et saisissez votre nom.",
      10,
      "normal",
      { gap: 2 }
    );
  }

  write("Empreinte SHA-256 du texte du contrat :", 9, "normal", { gap: 0.5, color: [75, 85, 99] });
  write(input.hash.slice(0, 32), 9, "normal", { gap: 0, color: [75, 85, 99] });
  write(input.hash.slice(32), 9, "normal", { gap: 2, color: [75, 85, 99] });
  write(
    "Pour TechLibrairie Édition : contrat généré et conservé automatiquement par la plateforme.",
    9,
    "italic",
    { gap: 0, color: [75, 85, 99] }
  );

  // Pied de page sur chaque page
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
