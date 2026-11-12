// src/app/catalogue/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { Currency, Prisma, ProductKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/produits/product-card";
import { PRODUCT_CURRENCIES } from "@/lib/product-validation";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Parcourez les livres édités par TechLibrairie Édition et les documents PDF publiés par nos auteurs et vendeurs.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

const SORTS = [
  { value: "recent", label: "Plus récents" },
  { value: "populaire", label: "Plus vendus" },
  { value: "notes", label: "Mieux notés" },
  { value: "prix-asc", label: "Prix croissant" },
  { value: "prix-desc", label: "Prix décroissant" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

const CURRENCY_VALUES: Currency[] = ["XOF", "EUR", "USD"];

type ServiceValue = "edition" | "document";

const SERVICE_KINDS: Record<ServiceValue, ProductKind> = {
  edition: "BOOK_EDITION",
  document: "PDF_DOCUMENT",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildOrderBy(sort: SortValue): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "populaire":
      return [{ salesCount: "desc" }, { publishedAt: "desc" }];
    case "notes":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }, { publishedAt: "desc" }];
    case "prix-asc":
      return [{ priceAmount: "asc" }, { publishedAt: "desc" }];
    case "prix-desc":
      return [{ priceAmount: "desc" }, { publishedAt: "desc" }];
    default:
      return [{ publishedAt: "desc" }];
  }
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const categorySlug = (first(sp.categorie) ?? "").trim().slice(0, 100);

  const rawService = first(sp.service);
  const service: ServiceValue | undefined =
    rawService === "edition" || rawService === "document" ? rawService : undefined;

  const rawCurrency = first(sp.devise);
  const currency = CURRENCY_VALUES.find((value) => value === rawCurrency);

  const rawSort = first(sp.tri);
  const requestedSort: SortValue =
    SORTS.find((option) => option.value === rawSort)?.value ?? "recent";

  // Le tri par prix n'a de sens que dans une seule devise.
  const isPriceSort = requestedSort === "prix-asc" || requestedSort === "prix-desc";
  const sort: SortValue = isPriceSort && !currency ? "recent" : requestedSort;

  const requestedPage = Number.parseInt(first(sp.page) ?? "1", 10);
  const safeRequestedPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Un numéro ISBN complet (10 ou 13 caractères, avec ou sans tirets) retrouve directement le livre.
  const isbnQuery = q.replace(/[\s-]/g, "").toUpperCase();
  const isIsbnSearch = /^(\d{13}|\d{9}[\dX])$/.test(isbnQuery);

  // Filtres communs, sans le service : ils servent aussi à compter les ouvrages de chaque onglet.
  const baseWhere: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    seller: { status: "ACTIVE" },
    ...(currency ? { currency } : {}),
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { authorName: { contains: q, mode: "insensitive" } },
            { seller: { displayName: { contains: q, mode: "insensitive" } } },
            ...(isIsbnSearch ? [{ isbn: isbnQuery }] : []),
          ],
        }
      : {}),
  };

  const where: Prisma.ProductWhereInput = {
    ...baseWhere,
    ...(service ? { kind: SERVICE_KINDS[service] } : {}),
  };

  const [total, categories, kindGroups] = await Promise.all([
    prisma.product.count({ where }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.product.groupBy({
      by: ["kind"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const countByKind = new Map(kindGroups.map((group) => [group.kind, group._count._all]));
  const editionCount = countByKind.get("BOOK_EDITION") ?? 0;
  const documentCount = countByKind.get("PDF_DOCUMENT") ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(safeRequestedPage, totalPages);

  const products = await prisma.product.findMany({
    where,
    orderBy: buildOrderBy(sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      seller: { select: { displayName: true } },
      category: { select: { name: true } },
    },
  });

  function buildHref(targetPage: number, targetService: ServiceValue | undefined = service): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categorySlug) params.set("categorie", categorySlug);
    if (targetService) params.set("service", targetService);
    if (currency) params.set("devise", currency);
    if (sort !== "recent") params.set("tri", sort);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/catalogue?${query}` : "/catalogue";
  }

  const tabs: { key: ServiceValue | undefined; label: string; count: number }[] = [
    { key: undefined, label: "Tout", count: editionCount + documentCount },
    { key: "edition", label: "Livres édités", count: editionCount },
    { key: "document", label: "Documents PDF", count: documentCount },
  ];

  const unavailable = first(sp.erreur) === "produit-indisponible";
  const hasFilters = Boolean(q || categorySlug || currency || service);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Catalogue</h1>
      <p className="mt-1 text-sm text-slate-600">
        Les livres édités par TechLibrairie Édition et les documents PDF mis en vente par leurs auteurs,
        téléchargeables immédiatement après paiement.
      </p>

      {unavailable && (
        <div className="alert-error mt-6">
          Cet ouvrage n&apos;est plus disponible à la vente.
        </div>
      )}

      <nav aria-label="Services" className="mt-6 flex flex-wrap gap-2 text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={buildHref(1, tab.key)}
            className={service === tab.key ? "btn-primary" : "btn-secondary"}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </nav>

      <form
        method="get"
        action="/catalogue"
        className="card mt-4 grid gap-4 md:grid-cols-5"
      >
        {service && <input type="hidden" name="service" value={service} />}

        <div className="md:col-span-2">
          <label htmlFor="q" className="label">
            Recherche
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Titre, auteur, mot-clé ou ISBN"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="categorie" className="label">
            Catégorie
          </label>
          <select
            id="categorie"
            name="categorie"
            defaultValue={categorySlug}
            className="input"
          >
            <option value="">Toutes</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="devise" className="label">
            Devise
          </label>
          <select id="devise" name="devise" defaultValue={currency ?? ""} className="input">
            <option value="">Toutes</option>
            {PRODUCT_CURRENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tri" className="label">
            Trier par
          </label>
          <select id="tri" name="tri" defaultValue={sort} className="input">
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:col-span-5">
          <button type="submit" className="btn-primary">
            Rechercher
          </button>
          {hasFilters && (
            <Link href="/catalogue" className="btn-secondary">
              Réinitialiser
            </Link>
          )}
          <p className="text-xs text-slate-500">
            Le tri par prix nécessite de choisir une devise.
          </p>
        </div>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        {total === 0
          ? "Aucun ouvrage trouvé."
          : `${total} ouvrage${total > 1 ? "s" : ""} trouvé${total > 1 ? "s" : ""}.`}
      </p>

      {products.length > 0 && (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-10 flex items-center justify-center gap-4 text-sm"
        >
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className="btn-secondary">
              Précédent
            </Link>
          ) : (
            <span className="btn-secondary pointer-events-none opacity-50">
              Précédent
            </span>
          )}

          <span className="text-slate-600">
            Page {page} sur {totalPages}
          </span>

          {page < totalPages ? (
            <Link href={buildHref(page + 1)} className="btn-secondary">
              Suivant
            </Link>
          ) : (
            <span className="btn-secondary pointer-events-none opacity-50">
              Suivant
            </span>
          )}
        </nav>
      )}
    </div>
  );
    }
