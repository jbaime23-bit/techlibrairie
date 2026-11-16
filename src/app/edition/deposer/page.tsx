// src/app/edition/deposer/page.tsx
// Dépôt d'un manuscrit : choix de la formule, puis formulaire par étapes.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { formatXofAmount, getEditionOffers } from "@/lib/edition-offers";
import {
  CONTRACT_VERSION,
  RIGHTS_WARRANTY_TEXT,
  SERVICE_START_TEXT,
  contractAcceptanceText,
} from "@/lib/edition-contract";
import { REVIEW_CONSENT_TEXT } from "@/lib/manuscript-validation";
import { ManuscriptWizard, type WizardFormula } from "@/components/edition/manuscript-wizard";

export const metadata: Metadata = {
  title: "Déposer mon manuscrit",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DeposerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawFormula = firstParam(sp.formule);
  const formula: WizardFormula | null =
    rawFormula === "auteur" || rawFormula === "editeur" ? rawFormula : null;

  const offers = getEditionOffers();

  // Aucune formule choisie : on propose les deux.
  if (!formula) {
    return (
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="eyebrow text-brand-700">TechLibrairie Édition</p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Déposer mon manuscrit</h1>
            <p className="mt-3 text-slate-600">Choisissez la formule d&apos;édition de votre livre.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <section className="card card-hover flex flex-col">
              <p className="eyebrow text-brand-700">Formule 1</p>
              <h2 className="mt-2 text-xl font-bold">Édition à compte d&apos;auteur</h2>
              <p className="mt-2 flex-1 text-sm text-slate-600">
                Forfait de {formatXofAmount(offers.authorFeeXof)} par livre, réglé juste après le dépôt. Vous
                gardez vos droits et 100 % de vos gains.
              </p>
              <Link href="/edition/deposer?formule=auteur" className="btn-primary mt-5 w-full">
                Choisir cette formule
              </Link>
            </section>

            <section className="card card-hover flex flex-col">
              <p className="eyebrow text-accent-700">Formule 2</p>
              <h2 className="mt-2 text-xl font-bold">Édition à compte d&apos;éditeur</h2>
              <p className="mt-2 flex-1 text-sm text-slate-600">
                Aucun frais d&apos;entrée : votre manuscrit est examiné par notre équipe éditoriale. S&apos;il est
                retenu, nous finançons son édition.
              </p>
              <Link href="/edition/deposer?formule=editeur" className="btn-accent mt-5 w-full">
                Choisir cette formule
              </Link>
            </section>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Vous souhaitez plutôt vendre un document PDF ? C&apos;est le rôle de la{" "}
            <Link href="/boutique/vendeur/inscription" className="font-semibold text-teal-700 hover:underline">
              boutique, espace vendeur
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const isAuthorFormula = formula === "auteur";
  const here = `/edition/deposer?formule=${formula}`;
  const user = await getCurrentUser();

  // Il faut un espace auteur : création ou connexion d'abord.
  if (!user) {
    return (
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow text-brand-700">
            {isAuthorFormula ? "Édition à compte d'auteur" : "Édition à compte d'éditeur"}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Créez votre espace auteur pour commencer</h1>
          <p className="mt-3 text-slate-600">
            Un compte gratuit vous permet de déposer votre manuscrit et de suivre chaque étape de votre édition.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/edition/inscription?callbackUrl=${encodeURIComponent(here)}`}
              className="btn-primary px-6 py-3 text-base"
            >
              Créer mon espace auteur
            </Link>
            <Link
              href={`/edition/connexion?callbackUrl=${encodeURIComponent(here)}`}
              className="btn-secondary px-6 py-3 text-base"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true, status: true },
  });

  if (!seller) {
    return (
      <div className="container-page py-10 sm:py-14">
        <div className="card mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-extrabold">Activez votre espace auteur</h1>
          <p className="mt-2 text-sm text-slate-600">
            Votre compte est un compte acheteur. Pour déposer un manuscrit, ouvrez votre espace auteur : cela
            prend une minute, sur ce même compte.
          </p>
          <div className="mt-6">
            <Link href="/publier" className="btn-primary">
              Ouvrir mon espace auteur
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (seller.status !== "ACTIVE") {
    return (
      <div className="container-page py-10 sm:py-14">
        <div className="alert-error mx-auto max-w-xl">
          Votre espace auteur est suspendu. Contactez l&apos;administration de TechLibrairie pour en savoir plus.
        </div>
      </div>
    );
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/edition" className="font-semibold text-brand-700 hover:underline">
            Retour à l&apos;édition
          </Link>
          <Link
            href={`/edition/deposer?formule=${isAuthorFormula ? "editeur" : "auteur"}`}
            className="font-semibold text-slate-600 hover:underline"
          >
            Changer de formule
          </Link>
        </div>

        <ManuscriptWizard
          formula={formula}
          sellerId={seller.id}
          sellerName={seller.displayName}
          categories={categories}
          feeXof={offers.authorFeeXof}
          isAdmin={user.role === "ADMIN"}
          terms={{
            contractVersion: CONTRACT_VERSION,
            warrantyText: RIGHTS_WARRANTY_TEXT,
            acceptanceText: contractAcceptanceText(offers.authorFeeXof),
            startText: SERVICE_START_TEXT,
            reviewConsentText: REVIEW_CONSENT_TEXT,
          }}
        />
      </div>
    </div>
  );
}
