// src/app/publier/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { activatePublishingAction } from "@/app/publier/actions";
import { getContributionConfig } from "@/lib/publication-fee";

export const metadata: Metadata = {
  title: "Publier : édition à compte d'auteur ou vente de PDF",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  nom: "Le nom d'auteur ou d'éditeur doit contenir au moins 2 caractères.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

const CAPACITY_OPTIONS = [
  {
    key: "auteur",
    label: "Auteur",
    description: "Vous avez écrit l'ouvrage et vous en détenez les droits.",
  },
  {
    key: "vendeur",
    label: "Titulaire des droits (ayant droit)",
    description:
      "Vous n'êtes pas l'auteur, mais vous détenez les droits d'édition et de diffusion, avec son autorisation écrite.",
  },
] as const;

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
              <h2 className="text-xl font-semibold">Édition à compte d&apos;auteur</h2>
              <p className="mt-2 text-sm text-slate-600">
                Faire éditer et publier votre livre par TechLibrairie Édition.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>
                  {user.role === "ADMIN" ? (
                    <strong>Aucun forfait n&apos;est demandé à l&apos;administrateur.</strong>
                  ) : (
                    <>
                      <strong>Forfait d&apos;édition de {formatXof(contribution.amountXof)}</strong> pour chaque
                      nouveau livre, réglé par Mobile Money <strong>juste après le dépôt</strong> de votre PDF.
                    </>
                  )}
                </li>
                <li>
                  Il couvre le contrôle, la mise en page et la publication. Vous validez un{" "}
                  <strong>bon à tirer</strong> : rien n&apos;est publié sans votre accord.
                </li>
                <li>
                  <strong>Vous gardez vos droits et 100 % de vos gains</strong> : aucune commission. Les frais
                  d&apos;impression d&apos;un exemplaire imprimé sont à votre charge, déduits de la vente.
                </li>
                <li>
                  Vous acceptez un <strong>contrat</strong> au dépôt, et déclarez détenir les droits.{" "}
                  <Link href="/contrat-edition" className="font-semibold text-brand-700 hover:underline">
                    Lire le contrat
                  </Link>
                  .
                </li>
              </ul>

              <p className="mt-4 text-sm font-semibold">Vous déposez en tant que :</p>
              <div className="mt-2 flex flex-col gap-2">
                {CAPACITY_OPTIONS.map((option) => (
                  <Link
                    key={option.key}
                    href={`/vendeur/produits/nouveau?service=edition&profil=${option.key}`}
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
                  Publication <strong>immédiate</strong>, sans forfait d&apos;édition.
                </li>
                <li>
                  Ce service obéit à sa propre logique de distribution : il ne doit pas être confondu avec
                  l&apos;édition à compte d&apos;auteur. Vos documents ne portent ni ISBN ni statut d&apos;édition.
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
              l&apos;édition à compte d&apos;auteur et la vente de PDF.
            </p>

            <form action={activatePublishingAction} className="mt-5 space-y-4">
              <div>
                <label htmlFor="displayName" className="label">
                  Nom d&apos;auteur (affiché au public)
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
                  {CAPACITY_OPTIONS.map((option) => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="profil"
                        value={option.key}
                        defaultChecked={option.key === "auteur"}
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
              Vous devrez <strong>déclarer</strong> être l&apos;auteur ou le titulaire des droits : cette
              déclaration est enregistrée avec la date. Déposer l&apos;ouvrage d&apos;autrui sans autorisation est
              interdit.
            </li>
            <li>
              Pour l&apos;édition à compte d&apos;auteur, un <strong>numéro ISBN</strong> si vous en possédez un
              (facultatif).
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
