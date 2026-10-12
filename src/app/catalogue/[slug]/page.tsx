// src/app/catalogue/[slug]/page.tsx
import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCartIds } from "@/lib/cart";
import { addToCartAction } from "@/app/panier/actions";
import { ProductCard } from "@/components/produits/product-card";
import { formatDate, formatFileSize, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const getPublishedProduct = cache(async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      seller: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          bio: true,
          status: true,
          userId: true,
        },
      },
      category: { select: { name: true, slug: true } },
    },
  });

  if (!product || product.status !== "PUBLISHED" || product.seller.status !== "ACTIVE") {
    return null;
  }
  return product;
});

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await getPublishedProduct(params.slug);

  if (!product) {
    return { title: "Ouvrage introuvable" };
  }

  return {
    title: product.title,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 160),
      images: product.coverImageUrl ? [product.coverImageUrl] : undefined,
    },
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  "votre-ouvrage": "Vous êtes l'auteur de cet ouvrage : vous ne pouvez pas l'acheter.",
  "deja-achete": "Vous avez déjà acheté cet ouvrage.",
  "panier-plein": "Votre panier est plein (20 ouvrages maximum).",
  "devise-differente":
    "Votre panier contient des ouvrages dans une autre devise. Finalisez ou videz votre panier avant d'ajouter cet ouvrage.",
};

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { erreur?: string | string[] };
}) {
  const product = await getPublishedProduct(params.slug);

  if (!product) {
    notFound();
  }

  const user = await getCurrentUser();
  const isAuthor = user !== null && user.id === product.seller.userId;
  const inCart = getCartIds().includes(product.id);

  const errorKey = Array.isArray(searchParams.erreur)
    ? searchParams.erreur[0]
    : searchParams.erreur;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined;

  const moreFromSeller = await prisma.product.findMany({
    where: {
      sellerId: product.seller.id,
      status: "PUBLISHED",
      id: { not: product.id },
    },
    orderBy: { publishedAt: "desc" },
    take: 4,
    include: {
      seller: { select: { displayName: true } },
      category: { select: { name: true } },
    },
  });

  return (
    <div className="container-page py-8">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/catalogue" className="hover:text-brand-700">
          Catalogue
        </Link>
        {product.category && (
          <>
            {" / "}
            <Link
              href={`/catalogue?categorie=${product.category.slug}`}
              className="hover:text-brand-700"
            >
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      {errorMessage && <div className="alert-error mb-6">{errorMessage}</div>}

      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {product.coverImageUrl ? (
            <Image
              src={product.coverImageUrl}
              alt={`Couverture de ${product.title}`}
              width={320}
              height={427}
              priority
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-4xl font-bold text-slate-300">PDF</span>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold">{product.title}</h1>
          <p className="mt-2 text-slate-600">
            par{" "}
            <Link
              href={`/auteurs/${product.seller.slug}`}
              className="font-semibold text-brand-700 hover:underline"
            >
              {product.seller.displayName}
            </Link>
          </p>

          <p className="mt-6 text-3xl font-bold">
            {formatPrice(product.priceAmount, product.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aucune taxe supplémentaire. Téléchargement immédiat après paiement.
          </p>

          <div className="mt-6 max-w-sm">
            {isAuthor ? (
              <div className="alert-error">
                Vous êtes l&apos;auteur de cet ouvrage.
              </div>
            ) : inCart ? (
              <Link href="/panier" className="btn-secondary w-full">
                Déjà dans le panier : voir le panier
              </Link>
            ) : (
              <form action={addToCartAction}>
                <input type="hidden" name="productId" value={product.id} />
                <button type="submit" className="btn-primary w-full">
                  Ajouter au panier
                </button>
              </form>
            )}
          </div>

          <dl className="mt-8 grid max-w-md grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Format</dt>
            <dd>PDF ({formatFileSize(product.pdfSizeBytes)})</dd>

            <dt className="text-slate-500">Langue</dt>
            <dd>{LANGUAGE_LABELS[product.language] ?? product.language}</dd>

            {product.pageCount && (
              <>
                <dt className="text-slate-500">Pages</dt>
                <dd>{product.pageCount}</dd>
              </>
            )}

            <dt className="text-slate-500">Publié le</dt>
            <dd>{formatDate(product.publishedAt)}</dd>
          </dl>

          <h2 className="mt-8 text-lg font-semibold">Description</h2>
          <p className="mt-2 whitespace-pre-line text-slate-700">
            {product.description}
          </p>

          {product.seller.bio && (
            <>
              <h2 className="mt-8 text-lg font-semibold">
                À propos de{" "}
                <Link
                  href={`/auteurs/${product.seller.slug}`}
                  className="text-brand-700 hover:underline"
                >
                  {product.seller.displayName}
                </Link>
              </h2>
              <p className="mt-2 whitespace-pre-line text-slate-700">
                {product.seller.bio}
              </p>
            </>
          )}
        </div>
      </div>

      {moreFromSeller.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">
            Autres ouvrages de {product.seller.displayName}
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {moreFromSeller.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
                                           }
