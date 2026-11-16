// src/app/boutique/page.tsx
// Hub de la boutique, distinct de l'édition : espace acheteur et espace vendeur, catalogue et PDF gratuits.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ProductCard, type ProductCardData } from "@/components/produits/product-card";
import { bpsToPercent, getDefaultCommissionRateBps } from "@/lib/commission";

export const metadata: Metadata = {
  title: "La boutique TechLibrairie : livres et guides techniques en PDF",
  description:
    "Achetez et téléchargez des livres et guides techniques en PDF, ou vendez vos propres documents : la boutique TechLibrairie a son espace acheteur et son espace vendeur.",
  alternates: { canonical: "/boutique" },
};

export const dynamic = "force-dynamic";

async function loadLatestProducts(): Promise<ProductCardData[]> {
  try {
    return await prisma.product.findMany({
      where: { status: "PUBLISHED", seller: { status: "ACTIVE" } },
      orderBy: { publishedAt: "desc" },
      take: 4,
      include: {
        seller: { select: { displayName: true } },
        category: { select: { name: true } },
      },
    });
  } catch (error) {
    console.error("Boutique : lecture des ouvrages impossible :", error);
    return [];
  }
}

export default async function BoutiquePage() {
  const [user, products, defaultRateBps] = await Promise.all([
    getCurrentUser(),
    loadLatestProducts(),
    getDefaultCommissionRateBps(),
  ]);

  const commission = bpsToPercent(defaultRateBps);
  const isSeller = user?.role === "SELLER" || user?.role === "ADMIN";

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-900 via-teal-700 to-cyan-700 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="container-page relative py-14 sm:py-20">
          <p className="eyebrow text-amber-200">Boutique TechLibrairie</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold sm:text-5xl">
            Livres et guides techniques en PDF
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-teal-50">
            Achetez et téléchargez immédiatement, ou mettez vos propres documents en vente. La boutique est un
            espace à part de la maison d&apos;édition, avec ses propres comptes acheteur et vendeur.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/catalogue" className="btn-light px-6 py-3 text-base">
              Parcourir le catalogue
            </Link>
            <Link href="/gratuit" className="btn-outline-light px-6 py-3 text-base">
              PDF gratuits
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="card card-hover border-teal-100">
            <p className="eyebrow text-teal-700">Espace acheteur</p>
            <h2 className="mt-2 text-2xl font-extrabold">J&apos;achète des PDF</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Téléchargement immédiat après paiement</li>
              <li>Vos achats toujours disponibles dans votre espace</li>
              <li>Vos favoris et le suivi de vos livres imprimés</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              {user ? (
                <Link href="/acheteur" className="btn-teal">
                  Mon espace acheteur
                </Link>
              ) : (
                <>
                  <Link href="/boutique/acheteur/inscription" className="btn-teal">
                    Créer mon compte acheteur
                  </Link>
                  <Link
                    href="/boutique/acheteur/connexion"
                    className="btn border border-teal-200 bg-white text-teal-800 hover:bg-teal-50"
                  >
                    Me connecter
                  </Link>
                </>
              )}
            </div>
          </article>

          <article className="card card-hover border-emerald-100">
            <p className="eyebrow text-emerald-700">Espace vendeur</p>
            <h2 className="mt-2 text-2xl font-extrabold">Je vends mes PDF</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Publication immédiate de vos documents (cours, rapports, guides)</li>
              <li>Commission de la boutique : {commission} % sur chaque vente</li>
              <li>Suivi des ventes et versements par Mobile Money</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              {isSeller ? (
                <Link href="/vendeur" className="btn-teal">
                  Mon espace vendeur
                </Link>
              ) : user ? (
                <Link href="/vendeur/activer" className="btn-teal">
                  Activer mon profil vendeur
                </Link>
              ) : (
                <>
                  <Link href="/boutique/vendeur/inscription" className="btn-teal">
                    Créer mon compte vendeur
                  </Link>
                  <Link
                    href="/boutique/vendeur/connexion"
                    className="btn border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                  >
                    Me connecter
                  </Link>
                </>
              )}
            </div>
          </article>
        </div>
      </section>

      {products.length > 0 && (
        <section className="bg-white py-14">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-extrabold">Dernières publications</h2>
              <Link href="/catalogue" className="text-sm font-semibold text-teal-700 hover:underline">
                Tout voir
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-page py-14">
        <div className="rounded-3xl bg-gradient-to-r from-brand-700 via-violet-700 to-fuchsia-600 p-8 text-white sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-accent-300">TechLibrairie Édition</p>
              <h2 className="mt-2 text-2xl font-extrabold">Vous avez écrit un livre ?</h2>
              <p className="mt-2 max-w-xl text-brand-100">
                La maison d&apos;édition vous accompagne : mise en page, publication en PDF et en livre imprimé à la
                demande.
              </p>
            </div>
            <Link href="/edition" className="btn-accent px-6 py-3 text-base">
              Découvrir l&apos;édition
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
              }
