// src/app/profil/donnees/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Télécharger mes données",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "mot-de-passe": "Mot de passe incorrect.",
  limite: "Trop de tentatives ou de téléchargements récents. Patientez 15 minutes avant de réessayer.",
  requete: "Requête invalide. Veuillez réessayer.",
  technique: "Une erreur est survenue lors de la préparation du fichier. Réessayez dans un instant.",
  introuvable: "Compte introuvable.",
};

export default async function DonneesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireUser("/profil/donnees");

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/profil"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Retour à mon profil
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Télécharger mes données</h1>
          <p className="mt-1 text-sm text-slate-600">
            Obtenez une copie de toutes les données que TechLibrairie conserve sur votre compte,
            dans un fichier lisible (format JSON).
          </p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <section className="card text-sm text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Ce que contient le fichier</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Votre compte : nom, adresse email, téléphone, type de compte, dates.</li>
            <li>Vos commandes : ouvrages, montants, paiements.</li>
            <li>Vos conversations avec le support, réponses de l&apos;équipe comprises.</li>
            <li>Vos messages envoyés par le formulaire de contact.</li>
            {user.role === "SELLER" && (
              <li>Votre profil vendeur, vos ouvrages et vos versements.</li>
            )}
          </ul>

          <h2 className="mt-5 text-lg font-semibold text-slate-900">Ce qu&apos;il ne contient pas</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Votre mot de passe et vos clés de sécurité.</li>
            <li>Les fichiers PDF eux-mêmes : téléchargez-les depuis « Mes commandes ».</li>
            <li>Les données des autres utilisateurs.</li>
          </ul>
        </section>

        <section className="card">
          <form method="post" action="/api/profil/export" className="space-y-4">
            <div>
              <label htmlFor="password" className="label">
                Votre mot de passe (pour confirmer que c&apos;est bien vous)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
              />
            </div>

            <button type="submit" className="btn-primary">
              Télécharger mes données
            </button>

            <p className="text-xs text-slate-500">
              Le fichier contient des données personnelles : conservez-le en lieu sûr.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
      }
