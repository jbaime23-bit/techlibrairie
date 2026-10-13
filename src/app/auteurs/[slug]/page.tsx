// src/app/auteurs/[slug]/page.tsx
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/produits/product-card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const getSeller = cache(async (slug: string) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { slug },
    include: { user: { select: { isActive: true } } },
  });

  if (!seller || seller.status !== "ACTIVE" || !seller.user.isActive) {
    return null;
  }
  return seller;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getSeller(slug);

  if (!seller) {
    return { title: "Auteur introuvable" };
  }

  return {
    title: seller.displayName,
    description:
      seller.bio?.slice(0, 160) ??
      `Les livres et guides techniques de ${seller.displayName} sur TechLibrairie.`,
  };
}

export default async function AuteurPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seller = await getSeller(slug);

  if (!seller) {
    notFound();
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where: { sellerId: seller.id, status: "PUBLISHED" } }),
    prisma.product.findMany({
      where: { sellerId: seller.id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 48,
      include: {
        seller: { select: { displayName: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  const initial = seller.displayName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="container-page py-8">
      <header className="card flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          aria-hidden="true"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-3xl font-bold text-brand-700"
        >
          {initial}
        </div>

        <div>
          <h1 className="text-3xl font-bold">{seller.displayName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sur TechLibrairie depuis le {formatDate(seller.createdAt)} · {total}{" "}
            ouvrage{total > 1 ? "s" : ""} en vente
          </p>
          {seller.bio && (
            <p className="mt-4 whitespace-pre-line text-slate-700">{seller.bio}</p>
          )}
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Ouvrages de {seller.displayName}</h2>

        {products.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Cet auteur n&apos;a pas d&apos;ouvrage en vente pour le moment.
          </p>
        ) : (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {total > products.length && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Les {products.length} ouvrages les plus récents sont affichés.
          </p>
        )}
      </section>
    </div>
  );
      }
