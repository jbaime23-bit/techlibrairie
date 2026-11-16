// src/app/page.tsx
// Accueil : l'édition d'abord (bandeau, deux formules, étapes), puis un aperçu de la boutique.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdSlot from "@/components/publicite/AdSlot";
import { ProductCard, type ProductCardData } from "@/components/produits/product-card";
import { FormulaCards } from "@/components/edition/formula-cards";
import { ProcessSteps } from "@/components/edition/process-steps";
import { getEditionOffers } from "@/lib/edition-offers";
import { getPaymentMethods, paymentSummary } from "@/lib/payment-methods";

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
    console.error("Accueil : lecture des ouvrages impossible :", error);
    return [];
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string | string[] }>;
}) {
  const { erreur } = await searchParams;
  const accessDenied = erreur === "acces-refuse";
  const latestProducts = await loadLatestProducts();
  const offers = getEditionOffers();
  const summary = paymentSummary(getPaymentMethods());

  return (
    <div>
      {accessDenied && (
        <div className="container-page pt-6">
          <div className="alert-error">
            Vous n&apos;avez pas l&apos;autorisation d&apos;accéder à cette page.
          </div>
        </div>
      )}

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-violet-700 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />

        <div className="container-page relative py-16 sm:py-24">
          <p className="eyebrow text-accent-300">TechLibrairie Édition</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
            Votre livre mérite d&apos;être publié.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-brand-100">
            Maison d&apos;édition numérique et imprimée à la demande, TechLibrairie accompagne les auteurs
            francophones : mise en page professionnelle, publication en PDF et en livre imprimé, distribution
            dans sa boutique.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/edition/deposer" className="btn-accent px-6 py-3 text-base">
              Déposer mon manuscrit
            </Link>
            <Link href="/edition#formules" className="btn-outline-light px-6 py-3 text-base">
              Découvrir nos deux formules
            </Link>
          </div>

          <ul className="mt-10 flex flex-wrap gap-3 text-sm font-semibold">
            <li className="rounded-full bg-white/15 px-4 py-2">Vous gardez vos droits</li>
            <li className="rounded-full bg-white/15 px-4 py-2">Mise en page professionnelle</li>
            <li className="rounded-full bg-white/15 px-4 py-2">PDF et livre imprimé à la demande</li>
          </ul>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-brand-700">Deux façons d&apos;être publié</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Choisissez la formule qui vous convient</h2>
          <p className="mt-3 text-slate-600">
            Vous financez votre édition et vous gardez tout, ou nous l&apos;investissons pour vous si votre
            manuscrit est retenu.
          </p>
        </div>

        <div className="mt-10">
          <FormulaCards offers={offers} />
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-brand-700">Comment ça marche</p>
            <h2 className="mt-2 text-3xl font-extrabold">De votre manuscrit à votre livre publié</h2>
          </div>
          <div className="mt-10">
            <ProcessSteps />
          </div>
          <div className="mt-8 text-center">
            <Link href="/edition" className="btn-secondary">
              Tout savoir sur l&apos;édition
            </Link>
          </div>
        </div>
      </section>

      <div className="container-page">
        <AdSlot placement="HOME_TOP" />
      </div>

      <section className="bg-gradient-to-br from-teal-50 via-white to-cyan-50 py-14">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-teal-700">La boutique</p>
              <h2 className="mt-2 text-3xl font-extrabold">Livres et guides techniques en PDF</h2>
              <p className="mt-2 max-w-xl text-slate-600">
                Achetez et téléchargez immédiatement des ressources écrites par des auteurs et éditeurs
                passionnés. {summary}.
              </p>
            </div>
            <Link href="/boutique" className="btn-teal">
              Entrer dans la boutique
            </Link>
          </div>

          {latestProducts.length > 0 && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {latestProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <AdSlot placement="HOME_MIDDLE" />
        </div>
      </section>

      <section className="container-page py-14">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 via-violet-700 to-fuchsia-600 p-8 text-center text-white sm:p-12">
          <h2 className="text-3xl font-extrabold">Prêt à publier votre livre ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Déposez votre projet en quelques étapes simples. Nous vous accompagnons jusqu&apos;à la publication.
          </p>
          <div className="mt-6">
            <Link href="/edition/deposer" className="btn-accent px-6 py-3 text-base">
              Déposer mon manuscrit
            </Link>
          </div>
        </div>
        <AdSlot placement="HOME_BOTTOM" />
      </section>
    </div>
  );
}
