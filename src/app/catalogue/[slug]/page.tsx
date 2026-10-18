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
import { deleteOwnReviewAction, saveReviewAction } from "@/app/avis/actions";
import { FavoriteButton } from "@/components/produits/favorite-button";
import { ProductCard } from "@/components/produits/product-card";
import { RatingStars } from "@/components/produits/rating-stars";
import { MAX_REVIEW_LENGTH, publicReviewerName } from "@/lib/reviews";
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);

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

const REVIEW_SUCCESS: Record<string, string> = {
  enregistre: "Merci, votre avis a été enregistré.",
  supprime: "Votre avis a été supprimé.",
};

const REVIEW_ERRORS: Record<string, string> = {
  "non-acheteur": "Seuls les acheteurs de cet ouvrage peuvent donner leur avis.",
  note: "Choisissez une note de 1 à 5 étoiles.",
  commentaire: "Votre commentaire doit contenir au moins 5 caractères (ou rester vide).",
  limite: "Trop d'avis enregistrés aujourd'hui. Réessayez demain.",
  masque: "Votre avis a été masqué par la modération : il n'est plus modifiable.",
};

const FAVORITE_SUCCESS: Record<string, string> = {
  ajoute: "Ouvrage ajouté à vos favoris.",
  retire: "Ouvrage retiré de vos favoris.",
};

const FAVORITE_ERRORS: Record<string, string> = {
  plein: "Vous avez atteint le maximum de 200 favoris.",
  erreur: "Une erreur est survenue. Veuillez réessayer.",
};

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    erreur?: string | string[];
    avis?: string | string[];
    favori?: string | string[];
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const product = await getPublishedProduct(slug);

  if (!product) {
    notFound();
  }

  const user = await getCurrentUser();
  const isAuthor = user !== null && user.id === product.seller.userId;
  const inCart = (await getCartIds()).includes(product.id);

  const errorKey = Array.isArray(query.erreur) ? query.erreur[0] : query.erreur;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined;

  const reviewKey = Array.isArray(query.avis) ? query.avis[0] : query.avis;
  const reviewSuccess = reviewKey ? REVIEW_SUCCESS[reviewKey] : undefined;
  const reviewError = reviewKey ? REVIEW_ERRORS[reviewKey] : undefined;

  const favoriteKey = Array.isArray(query.favori) ? query.favori[0] : query.favori;
  const favoriteSuccess = favoriteKey ? FAVORITE_SUCCESS[favoriteKey] : undefined;
  const favoriteError = favoriteKey ? FAVORITE_ERRORS[favoriteKey] : undefined;

  const [moreFromSeller, reviews, distribution, purchase, ownReview, favorite] =
    await Promise.all([
      prisma.product.findMany({
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
      }),
      prisma.review.findMany({
        where: { productId: product.id, status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: { productId: product.id, status: "PUBLISHED" },
        _count: { _all: true },
      }),
      user && !isAuthor
        ? prisma.orderItem.findFirst({
            where: {
              productId: product.id,
              order: { buyerId: user.id, status: "PAID" },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      user
        ? prisma.review.findUnique({
            where: { productId_userId: { productId: product.id, userId: user.id } },
          })
        : Promise.resolve(null),
      user
        ? prisma.favorite.findUnique({
            where: { userId_productId: { userId: user.id, productId: product.id } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

  const countByRating = new Map(distribution.map((row) => [row.rating, row._count._all]));
  const canReview = Boolean(purchase) && !isAuthor;

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

      {favoriteSuccess && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {favoriteSuccess}{" "}
          <Link href="/favoris" className="font-semibold underline">
            Voir mes favoris
          </Link>
        </div>
      )}
      {favoriteError && <div className="alert-error mb-6">{favoriteError}</div>}

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

          {product.ratingCount > 0 && (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <RatingStars value={product.ratingAverage} />
              <a href="#avis" className="hover:underline">
                {product.ratingAverage.toFixed(1).replace(".", ",")} sur 5 ({product.ratingCount} avis)
              </a>
            </p>
          )}

          <p className="mt-6 text-3xl font-bold">
            {formatPrice(product.priceAmount, product.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aucune taxe supplémentaire. Téléchargement immédiat après paiement.
          </p>

          <div className="mt-6 max-w-sm space-y-3">
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

            <FavoriteButton
              productId={product.id}
              isFavorite={Boolean(favorite)}
              from="produit"
              fullWidth
            />
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

      <section id="avis" className="mt-14 scroll-mt-6">
        <h2 className="text-xl font-bold">Avis des acheteurs</h2>

        {reviewSuccess && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {reviewSuccess}
          </div>
        )}
        {reviewError && <div className="alert-error mt-4">{reviewError}</div>}

        <div className="mt-4 grid gap-8 lg:grid-cols-[280px_1fr]">
          <div>
            {product.ratingCount > 0 ? (
              <div className="card">
                <p className="text-4xl font-bold">
                  {product.ratingAverage.toFixed(1).replace(".", ",")}
                  <span className="text-lg font-normal text-slate-500"> / 5</span>
                </p>
                <div className="mt-1">
                  <RatingStars value={product.ratingAverage} large />
                </div>
                <p className="mt-1 text-sm text-slate-500">{product.ratingCount} avis</p>

                <ul className="mt-4 space-y-1 text-xs text-slate-600">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = countByRating.get(star) ?? 0;
                    const percent =
                      product.ratingCount > 0
                        ? Math.round((count / product.ratingCount) * 100)
                        : 0;

                    return (
                      <li key={star} className="flex items-center gap-2">
                        <span className="w-6 shrink-0">{star} ★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <span
                            className="block h-full bg-amber-500"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span className="w-6 shrink-0 text-right">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="card text-sm text-slate-600">
                Cet ouvrage n&apos;a pas encore d&apos;avis.
              </div>
            )}

            <div className="mt-4">
              {isAuthor ? (
                <p className="text-sm text-slate-500">
                  Vous ne pouvez pas noter votre propre ouvrage.
                </p>
              ) : !user ? (
                <p className="text-sm text-slate-600">
                  <Link
                    href={`/connexion?callbackUrl=${encodeURIComponent(`/catalogue/${product.slug}`)}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Connectez-vous
                  </Link>{" "}
                  pour donner votre avis si vous avez acheté cet ouvrage.
                </p>
              ) : !canReview ? (
                <p className="text-sm text-slate-600">
                  Seuls les acheteurs de cet ouvrage peuvent donner leur avis.
                </p>
              ) : ownReview?.status === "HIDDEN" ? (
                <p className="text-sm text-slate-600">
                  Votre avis a été masqué par la modération.
                </p>
              ) : (
                <div className="card">
                  <h3 className="font-semibold">
                    {ownReview ? "Modifier mon avis" : "Donner mon avis"}
                  </h3>

                  <form action={saveReviewAction} className="mt-3 space-y-3">
                    <input type="hidden" name="productId" value={product.id} />

                    <fieldset>
                      <legend className="label">Votre note</legend>
                      <div className="flex flex-wrap gap-3">
                        {[5, 4, 3, 2, 1].map((star) => (
                          <label key={star} className="flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name="rating"
                              value={star}
                              required
                              defaultChecked={ownReview?.rating === star}
                            />
                            {star} ★
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div>
                      <label htmlFor="review-comment" className="label">
                        Votre commentaire (facultatif)
                      </label>
                      <textarea
                        id="review-comment"
                        name="comment"
                        rows={4}
                        maxLength={MAX_REVIEW_LENGTH}
                        defaultValue={ownReview?.comment ?? ""}
                        className="input"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Votre avis affichera votre prénom et l&apos;initiale de votre nom.
                      </p>
                    </div>

                    <button type="submit" className="btn-primary">
                      {ownReview ? "Enregistrer les modifications" : "Publier mon avis"}
                    </button>
                  </form>

                  {ownReview && (
                    <form action={deleteOwnReviewAction} className="mt-3">
                      <input type="hidden" name="productId" value={product.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-700 hover:underline"
                      >
                        Supprimer mon avis
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-600">
                Soyez le premier à donner votre avis après votre achat.
              </p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <RatingStars value={review.rating} />
                        <span className="text-sm font-semibold">
                          {publicReviewerName(review.user.name)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-700">
                        {review.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {product.ratingCount > reviews.length && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Les {reviews.length} avis les plus récents sont affichés.
              </p>
            )}
          </div>
        </div>
      </section>

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
