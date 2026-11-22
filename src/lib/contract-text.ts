// src/lib/contract-text.ts
// Découpe le texte archivé d'un contrat (format produit par contractToPlainText) en titre, parties et sections.

export interface ParsedContract {
  title: string;
  subtitle: string;
  parties: string[];
  sections: { heading: string; paragraphs: string[] }[];
}

const HEADING = /^(Article \d+\.|Annexe [A-Z]\.)/;

export function parseContractText(text: string): ParsedContract {
  const blocks = text
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block !== "");

  const parties: string[] = [];
  const sections: { heading: string; paragraphs: string[] }[] = [];
  let current: { heading: string; paragraphs: string[] } | null = null;

  for (let index = 2; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (HEADING.test(block)) {
      current = { heading: block, paragraphs: [] };
      sections.push(current);
    } else if (current) {
      current.paragraphs.push(block);
    } else {
      parties.push(block);
    }
  }

  return { title: blocks[0] ?? "", subtitle: blocks[1] ?? "", parties, sections };
          }
