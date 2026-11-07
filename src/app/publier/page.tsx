// src/app/publier/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { activatePublishingAction } from "@/app/publier/actions";
import { getContributionConfig } from "@/lib/publication-fee";
import {
  PUBLISHING_CAPACITIES,
  type PublishingCapacityValue,
} from "@/lib/product-validation";

export const metadata: Metadata = {
  title: "Publier : édition de livres ou vente de PDF",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const QUERY_KEYS: Record<PublishingCapacityValue, string> = {
  AUTHOR: "auteur",
  INDEPENDENT_PUBLISHER: "editeur",
  THIRD_PARTY_SELLER: "vendeur",
};

const ERRORS: Record<string, string> = {
  nom: "Le nom d'auteur ou d'éditeur doit contenir au moins 2 caractères.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function PublierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireUser("/publier");

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, displayName: true },
  });

  const contribution = getContributionConfig();
  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Publier sur TechLibrairie</h1>
          <p className="mt-1 text-sm text-slate-600">
            Deux services distincts partagent le même espace, avec des règles différentes. Choisissez celui
            qui correspond à votre démarche.
          </p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {profile && profile.status === "SUSPENDED" && (
          <div className="alert-error">
            Votre compte vendeur est suspendu. Contactez l&apos;administration de TechLibrairie pour en savoir
            plus.
          </div>
        )}

        {profile && profile.status === "ACTIVE" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card flex flex-col">
              <h2 className="text-xl font-semibold">Édition de livres</h2>
              <p className="mt-2 text-sm text-slate-600">
                Faire éditer et publier un livre sur TechLibrairie, maison d&apos;édition numérique.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>
                  Vous renseignez votre livre et envoyez votre PDF.{" "}
                  {user.role === "ADMIN" ? (
                    <>
                      <strong>Aucune contribution n&apos;est demandée à l&apos;administrateur.</strong>
                    </>
                  ) : (
                    <>
                      <strong>À la dernière étape, juste avant la publication</strong>, une contribution unique de{" "}
                      {formatXof(contribution.amountXof)} est demandée pour cet ouvrage. Aucun paiement n&apos;est
                      demandé avant.
                    </>
                  )}
                </li>
                <li>
                  Cette contribution sert exclusivement de participation au soutien technique et à
                  l&apos;hébergement du site. Elle n&apos;a <strong>aucun effet sur vos redevances</strong> : les
                  pourcentages et commissions que vous percevez sur les ventes restent totalement inchangés.
                </li>
                <li>
                  Numéro ISBN facultatif, et <strong>certification de vos droits</strong> (auteur ou titulaire
                  des droits, responsabilité face au BBDA et au dépôt légal).
                </li>
              </ul>

              <p className="mt-4 text-sm font-semibold">Vous publiez en tant que :</p>
              <div className="mt-2 flex flex-col gap-2">
                {PUBLISHING_CAPACITIES.map((option) => (
                  <Link
                    key={option.value}
                    href={`/vendeur/produits/nouveau?service=edition&profil=${QUERY_KEYS[option.value]}`}
                    className="btn-primary"
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </section>

            <section className="card flex flex-col">
              <h2 className="text-xl font-semibold">Vente de PDF</h2>
              <p className="mt-2 text-sm text-slate-600">
                Un espace distinct de dépôt et de vente directe de fichiers numériques : cours, rapports,
                guides et autres ressources.
              </p>
              <ul className="mt-3 flex-1 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>
                  Publication <strong>immédiate</strong>, sans contribution de participation.
                </li>
                <li>
                  Ce service obéit à sa propre logique de distribution : il ne doit pas être confondu avec
                  l&apos;édition de livres. Vos documents ne portent ni ISBN ni statut d&apos;édition.
                </li>
                <li>La commission de la boutique s&apos;applique sur chaque vente.</li>
              </ul>

              <div className="mt-4">
                <Link
                  href="/vendeur/produits/nouveau?service=document"
                  className="btn-secondary w-full"
                >
                  Vendre un PDF
                </Link>
              </div>
            </section>
          </div>
        )}

        {!profile && user.role !== "BUYER" && (
          <div className="card">
            <p className="text-sm text-slate-700">
              Votre compte n&apos;a pas encore de profil de publication. Créez-le pour pouvoir déposer vos
              documents.
            </p>
            <div className="mt-4">
              <Link href="/vendeur/activer" className="btn-primary">
                Activer mon profil de publication
              </Link>
            </div>
          </div>
        )}

        {!profile && user.role === "BUYER" && (
          <section className="card">
            <h2 className="text-lg font-semibold">Ouvrir mon espace de publication</h2>
            <p className="mt-1 text-sm text-slate-600">
              Votre compte actuel est un compte acheteur. Indiquez le nom sous lequel vous publiez : votre
              espace de publication est créé sur ce même compte. Vous serez ensuite déconnecté, puis il
              suffira de vous reconnecter avec les mêmes identifiants. Vous pourrez alors choisir entre
              l&apos;édition de livres et la vente de PDF.
            </p>

            <form action={activatePublishingAction} className="mt-5 space-y-4">
              <div>
                <label htmlFor="displayName" className="label">
                  Nom d&apos;auteur ou d&apos;éditeur (affiché au public)
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={user.name ?? ""}
                  className="input"
                />
              </div>

              <fieldset>
                <legend className="label">Votre qualité habituelle</legend>
                <div className="space-y-2">
                  {PUBLISHING_CAPACITIES.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="profil"
                        value={QUERY_KEYS[option.value]}
                        defaultChecked={option.value === "AUTHOR"}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-semibold">{option.label}</span>
                        <span className="block text-slate-600">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button type="submit" className="btn-primary">
                Ouvrir mon espace de publication
              </button>
            </form>
          </section>
        )}

        <section className="card text-sm text-slate-600">
          <h2 className="text-lg font-semibold text-slate-900">Avant de publier</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Un <strong>PDF</strong> de 50 Mo au maximum, et une couverture facultative (JPEG, PNG ou WebP,
              2 Mo).
            </li>
            <li>
              Vous devrez <strong>certifier</strong> être l&apos;auteur ou le titulaire des droits : cette
              déclaration est enregistrée avec la date. Publier l&apos;ouvrage d&apos;autrui sans autorisation est
              interdit.
            </li>
            <li>
              Pour l&apos;édition de livres, un <strong>numéro ISBN</strong> si vous en possédez un (facultatif).
              TechLibrairie n&apos;en attribue pas.
            </li>
            <li>
              Les règles complètes figurent dans les{" "}
              <Link href="/conditions" className="font-semibold text-brand-700 hover:underline">
                conditions générales
              </Link>
              .
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
