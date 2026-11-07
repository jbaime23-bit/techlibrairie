// src/app/vendeur/produits/nouveau/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { ProductForm } from "@/components/vendeur/product-form";
import { getContributionConfig } from "@/lib/publication-fee";
import type {
  ProductKindValue,
  PublishingCapacityValue,
} from "@/lib/product-validation";
import {
  bpsToPercent,
  getDefaultCommissionRateBps,
  resolveCommissionRateBps,
} from "@/lib/commission";

export const metadata: Metadata = {
  title: "Publier : édition de livres ou vente de PDF",
};

export const dynamic = "force-dynamic";

/** Service demandé dans l'adresse (?service=edition ou document), ou null. */
function kindFromQuery(value: string | undefined): ProductKindValue | null {
  if (value === "edition") return "BOOK_EDITION";
  if (value === "document") return "PDF_DOCUMENT";
  return null;
}

/** Qualité demandée dans l'adresse (?profil=auteur, editeur ou vendeur) ; auteur par défaut. */
function capacityFromQuery(value: string | undefined): PublishingCapacityValue {
  switch (value) {
    case "editeur":
      return "INDEPENDENT_PUBLISHER";
    case "vendeur":
      return "THIRD_PARTY_SELLER";
    default:
      return "AUTHOR";
  }
}

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function NouveauProduitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const context = await loadSellerPage("/vendeur/produits/nouveau");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const { seller } = context;
  const isAdmin = context.user.role === "ADMIN";
  const kind = kindFromQuery(firstParam(sp.service));
  const profilQuery = firstParam(sp.profil);
  const contribution = getContributionConfig();

  // Aucun service choisi : on propose les deux (les anciens liens « Nouveau produit » arrivent ici).
  if (!kind) {
    const editionHref = `/vendeur/produits/nouveau?service=edition${
      profilQuery ? `&profil=${encodeURIComponent(profilQuery)}` : ""
    }`;

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Que souhaitez-vous publier ?</h1>
          <p className="mt-1 text-sm text-slate-600">
            TechLibrairie propose deux services distincts, qui obéissent à des règles différentes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card flex flex-col">
            <h2 className="text-lg font-semibold">Édition de livres</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Faire éditer et publier un livre sur TechLibrairie. Vous renseignez votre livre, puis, à la
              dernière étape avant la publication
              {isAdmin
                ? " (non demandée à l'administrateur)"
                : `, une contribution unique de ${formatXof(contribution.amountXof)} est demandée pour cet ouvrage`}
              . Elle n&apos;a aucun effet sur vos redevances. ISBN facultatif et certification des droits.
            </p>
            <Link href={editionHref} className="btn-primary mt-4">
              Faire éditer un livre
            </Link>
          </section>

          <section className="card flex flex-col">
            <h2 className="text-lg font-semibold">Vente de PDF</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Déposer et vendre directement des documents et ressources (cours, rapports, guides...).
              Publication immédiate, sans contribution de participation.
            </p>
            <Link href="/vendeur/produits/nouveau?service=document" className="btn-secondary mt-4">
              Vendre un PDF
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const [categories, defaultRateBps] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getDefaultCommissionRateBps(),
  ]);

  const commissionPercent = bpsToPercent(
    resolveCommissionRateBps(seller.commissionRateBps, defaultRateBps)
  );

  const isEdition = kind === "BOOK_EDITION";
  const contributionXof = isEdition && !isAdmin ? contribution.amountXof : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {isEdition ? "Édition de livres" : "Vente de PDF"}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {isEdition ? "Faire éditer un livre" : "Vendre un document"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isEdition
            ? contributionXof !== null
              ? "Renseignez votre ouvrage. La contribution n'est demandée qu'à la dernière étape, juste avant la publication."
              : "Renseignez votre ouvrage : il est publié dès l'envoi du formulaire."
            : "Votre document est mis en vente dès l'envoi du formulaire."}{" "}
          <Link href="/vendeur/produits/nouveau" className="font-semibold text-brand-700 hover:underline">
            Changer de service
          </Link>
        </p>

        <div className="mt-6">
          <ProductForm
            sellerId={seller.id}
            sellerName={seller.displayName}
            categories={categories}
            commissionPercent={commissionPercent}
            kind={kind}
            initialCapacity={capacityFromQuery(profilQuery)}
            contributionXof={contributionXof}
          />
        </div>
      </div>
    </div>
  );
}
