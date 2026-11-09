// src/app/vendeur/produits/nouveau/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { ProductForm, type EditionFormTerms } from "@/components/vendeur/product-form";
import { getContributionConfig } from "@/lib/publication-fee";
import {
  CONTRACT_VERSION,
  RIGHTS_WARRANTY_TEXT,
  SERVICE_START_TEXT,
  contractAcceptanceText,
} from "@/lib/edition-contract";
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
  title: "Publier : édition à compte d'auteur ou vente de PDF",
};

export const dynamic = "force-dynamic";

/** Service demandé dans l'adresse (?service=edition ou document), ou null. */
function kindFromQuery(value: string | undefined): ProductKindValue | null {
  if (value === "edition") return "BOOK_EDITION";
  if (value === "document") return "PDF_DOCUMENT";
  return null;
}

/** Qualité demandée dans l'adresse (?profil=auteur ou vendeur) ; auteur par défaut. */
function capacityFromQuery(value: string | undefined): PublishingCapacityValue {
  return value === "vendeur" ? "THIRD_PARTY_SELLER" : "AUTHOR";
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
            <h2 className="text-lg font-semibold">Édition à compte d&apos;auteur</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Faire éditer votre livre par TechLibrairie Édition : contrôle, mise en page et publication.
              {isAdmin
                ? " Aucun forfait n'est demandé à l'administrateur."
                : ` Vous financez l'édition par un forfait de ${formatXof(contribution.amountXof)} par nouveau livre, réglé juste après le dépôt.`}{" "}
              Vous gardez vos droits et 100 % de vos gains, sans commission.
            </p>
            <Link href={editionHref} className="btn-primary mt-4">
              Faire éditer un livre
            </Link>
          </section>

          <section className="card flex flex-col">
            <h2 className="text-lg font-semibold">Vente de PDF</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Déposer et vendre directement des documents et ressources (cours, rapports, guides...).
              Publication immédiate, sans forfait d&apos;édition.
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

  const terms: EditionFormTerms | null = isEdition
    ? {
        contractVersion: CONTRACT_VERSION,
        warrantyText: RIGHTS_WARRANTY_TEXT,
        acceptanceText: contractAcceptanceText(contribution.amountXof),
        startText: SERVICE_START_TEXT,
      }
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {isEdition ? "Édition à compte d'auteur" : "Vente de PDF"}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {isEdition ? "Faire éditer un livre" : "Vendre un document"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isEdition
            ? contributionXof !== null
              ? "Déposez votre livre et acceptez le contrat. Le forfait d'édition est à régler juste après le dépôt."
              : "Déposez votre livre : il est publié dès l'envoi du formulaire."
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
            terms={terms}
          />
        </div>
      </div>
    </div>
  );
}
