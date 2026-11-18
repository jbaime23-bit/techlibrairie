// src/lib/assembly/manuscript.ts
// Lecture du manuscrit (texte collé, fichier .txt, .md ou .docx) et découpage en blocs :
// chapitres, sous-titres, paragraphes et séparations de scènes.

import { sanitizeText } from "@/lib/assembly/text-utils";

export type Block =
  | { type: "chapter"; text: string }
  | { type: "section"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "break" };

export interface ParseOptions {
  // Un retour à la ligne = un nouveau paragraphe (collage depuis Word) ; sinon une ligne vide sépare les paragraphes
  singleNewlineIsParagraph: boolean;
  autoDetectChapters: boolean;
}

export interface ParseResult {
  blocks: Block[];
  wordCount: number;
  chapterCount: number;
  replacedChars: number;
}

const BREAK_PATTERN = /^(?:\*\s*){3,}$|^[-—_=]{3,}$/;

const CHAPTER_WORD =
  /^(chapitre|chapter|partie|part)\s+(?:\d+|[ivxlcdm]+|premier|première|premiere|deuxième|deuxieme|second|seconde|troisième|troisieme|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|one|two|three|four|five|seven|eight|nine|ten)\b/i;

const SPECIAL_SECTION =
  /^(prologue|épilogue|epilogue|préface|preface|avant-propos|introduction|conclusion|remerciements|postface|annexes?|dédicace|dedicace|sommaire)\b/i;

function looksLikeChapter(line: string): boolean {
  if (line.length > 80) return false;
  if (CHAPTER_WORD.test(line)) return true;

  return SPECIAL_SECTION.test(line) && line.length <= 50 && !/[.,;]$/.test(line);
}

export function parseManuscript(raw: string, options: ParseOptions): ParseResult {
  const sanitized = sanitizeText(raw);
  const lines = sanitized.text.split("\n");

  const blocks: Block[] = [];
  let buffer: string[] = [];
  let wordCount = 0;
  let chapterCount = 0;

  const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

  const flush = (): void => {
    if (buffer.length === 0) return;

    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    buffer = [];

    if (text !== "") {
      blocks.push({ type: "paragraph", text });
      wordCount += countWords(text);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flush();
      continue;
    }

    if (line.startsWith("# ")) {
      flush();
      blocks.push({ type: "chapter", text: line.slice(2).trim() });
      chapterCount += 1;
      continue;
    }

    if (/^#{2,6}\s/.test(line)) {
      flush();
      blocks.push({ type: "section", text: line.replace(/^#{2,6}\s+/, "").trim() });
      continue;
    }

    if (BREAK_PATTERN.test(line)) {
      flush();
      blocks.push({ type: "break" });
      continue;
    }

    if (options.autoDetectChapters && looksLikeChapter(line)) {
      flush();
      blocks.push({ type: "chapter", text: line });
      chapterCount += 1;
      continue;
    }

    buffer.push(line);

    if (options.singleNewlineIsParagraph) {
      flush();
    }
  }

  flush();

  return { blocks, wordCount, chapterCount, replacedChars: sanitized.replaced };
}

/** Lit un fichier texte : UTF-8, avec repli sur Windows-1252 si des caractères sont illisibles. */
export async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);

  if (text.includes("\uFFFD")) {
    text = new TextDecoder("windows-1252").decode(buffer);
  }

  return text;
}

/** Convertit un fichier Word (.docx) en texte structuré : titres en « # », paragraphes séparés par une ligne vide. */
export async function docxToText(file: File): Promise<string> {
  const mod = (await import("mammoth/mammoth.browser")) as unknown as {
    default?: { convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };
    convertToHtml?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };

  const convert = mod.default?.convertToHtml ?? mod.convertToHtml;
  if (!convert) throw new Error("Bibliothèque de lecture Word introuvable.");

  const result = await convert({ arrayBuffer: await file.arrayBuffer() });
  const document = new DOMParser().parseFromString(result.value, "text/html");

  const clean = (element: Element): string => (element.textContent ?? "").replace(/\s+/g, " ").trim();
  const parts: string[] = [];

  document.body.childNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;

    const tag = node.tagName.toLowerCase();

    if (tag === "h1") {
      const text = clean(node);
      if (text) parts.push(`# ${text}`);
    } else if (/^h[2-6]$/.test(tag)) {
      const text = clean(node);
      if (text) parts.push(`## ${text}`);
    } else if (tag === "ul" || tag === "ol") {
      node.querySelectorAll("li").forEach((item) => {
        const text = clean(item);
        if (text) parts.push(`• ${text}`);
      });
    } else if (tag === "table") {
      node.querySelectorAll("tr").forEach((row) => {
        const cells = Array.from(row.querySelectorAll("td, th"))
          .map((cell) => clean(cell))
          .filter(Boolean);
        if (cells.length > 0) parts.push(cells.join(" - "));
      });
    } else {
      const text = clean(node);
      if (text) parts.push(text);
    }
  });

  return parts.join("\n\n");
}
