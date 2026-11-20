// src/lib/product-display.ts
// Affichage commun des ouvrages : badge (« Compte d'auteur », « TechLibrairie Édition » ou « Document PDF »),
// nom de l'auteur, mentions de transparence et données structurées pour les moteurs de recherche.

import type { Currency, EditionModel, ProductKind } from "@prisma/client";

export const KIND_LABELS: Record<ProductKind, string> = {
  BOOK_EDITION: "Compte d'auteur",
  PDF_DOCUMENT: "Document PDF",
};

export const KIND_BADGE_STYLES: Record<ProductKind, string> = {
  BOOK_EDITION: "bg-brand-100 text-brand-800",
  PDF_DOCUMENT: "bg-slate-100 text-slate-700",
};

export const EDITION_MODEL_LABELS: Record<EditionModel, string> = {
  AUTHOR_ACCOUNT: "Compte d'auteur",
  PUBLISHER_ACCOUNT: "TechLibrairie Édition",
};

export const EDITION_MODEL_STYLES: Record<EditionModel, string> = {
  AUTHOR_ACCOUNT: "bg-brand-100 text-brand-800",
  PUBLISHER_ACCOUNT: "bg-accent-100 text-accent-800",
};

export const EDITION_NOTE =
  "Édition à compte d'auteur : l'auteur a financé l'édition de ce livre. TechLibrairie Édition en a assuré la mise en page. Le contenu relève de la responsabilité de l'auteur.";

export const PUBLISHER_ACCOUNT_NOTE =
  "Édition à compte d'éditeur : ce livre a été sélectionné, édité et publié par TechLibrairie Édition.";

export const DOCUMENT_NOTE =
  "Document PDF mis en vente par son auteur ou son vendeur, après validation par TechLibrairie : il n'a pas fait l'objet d'un travail éditorial de TechLibrairie Édition.";

export const PUBLISHER_NAME = "TechLibrairie Édition";

interface BadgeSource {
  kind: ProductKind;
  editionModel?: EditionModel | null;
}

/** Badge d'un ouvrage : selon son service et, pour un livre édité, le modèle d'édition (compte d'auteur par défaut). */
export function productBadge(product: BadgeSource): { label: string; style: string } {
  if (product.kind === "BOOK_EDITION") {
    const model: EditionModel = product.editionModel ?? "AUTHOR_ACCOUNT";
    return { label: EDITION_MODEL_LABELS[model], style: EDITION_MODEL_STYLES[model] };
  }

  return { label: KIND_LABELS.PDF_DOCUMENT, style: KIND_BADGE_STYLES.PDF_DOCUMENT };
}

/** Mention de transparence affichée sur la page d'un ouvrage. */
export function productNote(product: BadgeSource): string {
  if (product.kind !== "BOOK_EDITION") return DOCUMENT_NOTE;
  return product.editionModel === "PUBLISHER_ACCOUNT" ? PUBLISHER_ACCOUNT_NOTE : EDITION_NOTE;
}

/** Nom de l'auteur à afficher : l'auteur déclaré, à défaut le nom du vendeur. */
export function displayAuthorName(product: {
  authorName?: string | null;
  seller: { displayName: string };
}): string {
  const author = product.authorName?.trim();
  return author && author.length > 0 ? author : product.seller.displayName;
}

export interface ProductJsonLdInput {
  title: string;
  description: string;
  slug: string;
  coverImageUrl: string | null;
  language: string;
  pageCount: number | null;
  priceAmount: number;
  currency: Currency;
  isbn: string | null;
  kind: ProductKind;
  authorName: string;
  publishedAt: Date;
  ratingAverage: number;
  ratingCount: number;
}

function absoluteUrl(siteUrl: string, value: string): string {
  return /^https?:\/\//.test(value) ? value : `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

/** Prix en unité principale : francs entiers pour le FCFA, centimes pour l'euro et le dollar. */
function jsonLdPrice(amount: number, currency: Currency): string {
  return currency === "XOF" ? String(amount) : (amount / 100).toFixed(2);
}

/** Données structurées schema.org d'un ouvrage (Book pour une édition, CreativeWork pour un document). */
export function buildProductJsonLd(
  product: ProductJsonLdInput,
  siteUrl: string
): Record<string, unknown> {
  const url = `${siteUrl}/catalogue/${product.slug}`;
  const isEdition = product.kind === "BOOK_EDITION";

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isEdition ? "Book" : "CreativeWork",
    name: product.title,
    description: product.description.slice(0, 500),
    url,
    inLanguage: product.language,
    datePublished: product.publishedAt.toISOString().slice(0, 10),
    author: { "@type": "Person", name: product.authorName },
    offers: {
      "@type": "Offer",
      price: jsonLdPrice(product.priceAmount, product.currency),
      priceCurrency: product.currency,
      availability: "https://schema.org/InStock",
      url,
    },
  };

  if (product.coverImageUrl) {
    data.image = absoluteUrl(siteUrl, product.coverImageUrl);
  }

  if (isEdition) {
    data.bookFormat = "https://schema.org/EBook";
    data.publisher = { "@type": "Organization", name: PUBLISHER_NAME };
    if (product.isbn) data.isbn = product.isbn;
    if (product.pageCount) data.numberOfPages = product.pageCount;
  } else {
    data.encodingFormat = "application/pdf";
  }

  if (product.ratingCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.ratingAverage.toFixed(1),
      reviewCount: product.ratingCount,
    };
  }

  return data;
}

/** Sérialisation sûre pour une balise script : le caractère « < » est neutralisé. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
    }
