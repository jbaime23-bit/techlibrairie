// src/app/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdSlot from "@/components/publicite/AdSlot";
import { ProductCard, type ProductCardData } from "@/components/produits/product-card";
import {
  getPaymentMethods,
  paymentFeature,
  paymentSummary,
} from "@/lib/payment-methods";

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

  const methods = getPaymentMethods();
  const summary = paymentSummary(methods);
  const feature = paymentFeature(methods);

  return (
    <div className="container-page py-8">
      {accessDenied && (
        <div className="alert-error mb-8">
          Vous n&apos;avez pas l&apos;autorisation d&apos;accéder à cette page.
        </div>
      )}

      <AdSlot placement="HOME_TOP" />

      <section className="mx-auto mt-4 max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Les meilleurs livres et guides techniques en PDF
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Achetez et téléchargez immédiatement des ressources écrites par des
          auteurs et éditeurs passionnés. {summary}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/catalogue" className="btn-primary">
            Parcourir le catalogue
          </Link>
          <Link href="/inscription" className="btn-secondary">
            Devenir vendeur
          </Link>
        </div>
      </section>

      {latestProducts.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Dernières publications</h2>
            <Link
              href="/catalogue"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              Tout voir
            </Link>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {latestProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <AdSlot placement="HOME_MIDDLE" />

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="card">
          <h2 className="text-lg font-semibold">Téléchargement immédiat</h2>
          <p className="mt-2 text-sm text-slate-600">
            Dès votre paiement confirmé, votre PDF est disponible au
            téléchargement, via un lien sécurisé personnel.
          </p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold">{feature.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{feature.text}</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold">Publiez vos ouvrages</h2>
          <p className="mt-2 text-sm text-slate-600">
            Auteurs et éditeurs : soumettez vos PDF, ils sont publiés
            automatiquement et vous suivez vos ventes en temps réel.
          </p>
        </div>
      </section>

      <AdSlot placement="HOME_BOTTOM" />
    </div>
  );
}
