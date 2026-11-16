// src/app/edition/deposer/page.tsx
// Point d'entrée du dépôt d'un manuscrit : choix de la formule, puis ouverture du formulaire.
// VERSION DE TRANSITION : la formule à compte d'auteur mène au formulaire actuel ; le formulaire par étapes
// et la formule à compte d'éditeur arrivent à l'étape suivante.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { formatXofAmount, getEditionOffers } from "@/lib/edition-offers";

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
  const formula = rawFormula === "auteur" || rawFormula === "editeur" ? rawFormula : null;

  const offers = getEditionOffers();
  const user = await getCurrentUser();
  const seller = user
    ? await prisma.sellerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true, status: true },
      })
    : null;

  const authorHref = !user
    ? `/edition/inscription?callbackUrl=${encodeURIComponent("/edition/deposer?formule=auteur")}`
    : seller
      ? "/vendeur/produits/nouveau?service=edition&profil=auteur"
      : "/publier";

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="eyebrow text-brand-700">TechLibrairie Édition</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Déposer mon manuscrit</h1>
          <p className="mt-3 text-slate-600">Choisissez la formule d&apos;édition de votre livre.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section
            className={`card card-hover flex flex-col ${
              formula === "auteur" ? "border-brand-500 ring-2 ring-brand-200" : ""
            }`}
          >
            <p className="eyebrow text-brand-700">Formule 1</p>
            <h2 className="mt-2 text-xl font-bold">Édition à compte d&apos;auteur</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Forfait de {formatXofAmount(offers.authorFeeXof)} par livre, réglé juste après le dépôt. Vous
              gardez vos droits et 100 % de vos gains.
            </p>
            <Link href={authorHref} className="btn-primary mt-5 w-full">
              {user ? "Continuer vers le dépôt" : "Créer mon espace auteur"}
            </Link>
            {!user && (
              <Link
                href={`/edition/connexion?callbackUrl=${encodeURIComponent("/edition/deposer?formule=auteur")}`}
                className="mt-3 text-center text-sm font-semibold text-brand-700 hover:underline"
              >
                J&apos;ai déjà un compte
              </Link>
            )}
          </section>

          <section
            className={`card flex flex-col ${
              formula === "editeur" ? "border-accent-500 ring-2 ring-accent-200" : ""
            }`}
          >
            <p className="eyebrow text-accent-700">Formule 2</p>
            <h2 className="mt-2 text-xl font-bold">Édition à compte d&apos;éditeur</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Aucun frais d&apos;entrée : votre manuscrit est examiné par notre équipe éditoriale. S&apos;il est
              retenu, nous financons son édition.
            </p>
            <div className="mt-5 rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-900">
              Le formulaire de soumission à l&apos;examen éditorial ouvre très prochainement. En attendant,
              présentez-nous votre projet par le formulaire de contact.
            </div>
            <Link href="/#contact" className="btn-accent mt-4 w-full">
              Nous écrire
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
