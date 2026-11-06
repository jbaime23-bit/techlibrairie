// src/app/publier/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { activatePublishingAction } from "@/app/publier/actions";
import {
  PUBLISHING_CAPACITIES,
  type PublishingCapacityValue,
} from "@/lib/product-validation";

export const metadata: Metadata = {
  title: "Publier un document ou un livre",
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

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Publier un document ou un livre</h1>
          <p className="mt-1 text-sm text-slate-600">
            TechLibrairie met votre PDF en vente (ou en téléchargement) auprès d&apos;un public francophone.
            Choisissez la qualité sous laquelle vous publiez : elle est enregistrée avec votre ouvrage.
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
          <ul className="grid gap-4 sm:grid-cols-3">
            {PUBLISHING_CAPACITIES.map((option) => (
              <li key={option.value} className="card flex flex-col">
                <h2 className="text-lg font-semibold">{option.label}</h2>
                <p className="mt-2 flex-1 text-sm text-slate-600">{option.description}</p>
                <Link
                  href={`/vendeur/produits/nouveau?profil=${QUERY_KEYS[option.value]}`}
                  className="btn-primary mt-4"
                >
                  Publier comme {option.label.toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
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
              suffira de vous reconnecter avec les mêmes identifiants.
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
                <legend className="label">Vous publiez en tant que</legend>
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
              Un <strong>numéro ISBN</strong> si vous en possédez un (facultatif). TechLibrairie n&apos;en
              attribue pas.
            </li>
            <li>
              Vous devrez <strong>certifier</strong> être l&apos;auteur ou le titulaire des droits : cette
              déclaration est enregistrée avec la date. Publier l&apos;ouvrage d&apos;autrui sans autorisation est
              interdit.
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
