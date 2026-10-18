// src/app/favoris/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { ProductCard } from "@/components/produits/product-card";
import { FavoriteButton } from "@/components/produits/favorite-button";

export const metadata: Metadata = {
  title: "Mes favoris",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  retire: "Ouvrage retiré de vos favoris.",
};

const ERRORS: Record<string, string> = {
  indisponible: "Cet ouvrage n'est plus disponible à la vente : il ne peut pas être ajouté aux favoris.",
  plein: "Vous avez atteint le maximum de 200 favoris.",
  erreur: "Une erreur est survenue. Veuillez réessayer.",
};

export default async function FavorisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireUser("/favoris");

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      product: {
        include: {
          seller: { select: { displayName: true, status: true } },
          category: { select: { name: true } },
        },
      },
    },
  });

  const key = firstParam(sp.favori);
  const message = key ? MESSAGES[key] : undefined;
  const error = key ? ERRORS[key] : undefined;

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Mes favoris</h1>
      <p className="mt-1 text-sm text-slate-600">
        Les ouvrages que vous avez mis de côté. Aucune alerte de prix n&apos;est envoyée.
      </p>

      {message && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error mt-6">{error}</div>}

      {favorites.length === 0 ? (
        <div className="card mt-6 text-center text-sm text-slate-600">
          <p>Vous n&apos;avez pas encore de favoris.</p>
          <div className="mt-4">
            <Link href="/catalogue" className="btn-primary">
              Parcourir le catalogue
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {favorites.map((favorite) => {
            const product = favorite.product;
            const available =
              product.status === "PUBLISHED" && product.seller.status === "ACTIVE";

            return (
              <li key={favorite.id} className="flex flex-col gap-2">
                {available ? (
                  <ProductCard product={product} />
                ) : (
                  <div className="card flex-1 text-sm">
                    <p className="font-semibold">{product.title}</p>
                    <p className="mt-1 text-slate-500">
                      Cet ouvrage n&apos;est plus disponible à la vente.
                    </p>
                  </div>
                )}

                <FavoriteButton
                  productId={product.id}
                  isFavorite
                  from="liste"
                  fullWidth
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
              }
