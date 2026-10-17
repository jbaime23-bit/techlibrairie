// src/app/profil/suppression/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { deleteOwnAccountAction } from "@/app/profil/suppression/actions";

export const metadata: Metadata = {
  title: "Supprimer mon compte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  confirmation: "Saisissez le mot SUPPRIMER pour confirmer.",
  limite: "Trop de tentatives échouées. Patientez 15 minutes avant de réessayer.",
  "mot-de-passe": "Mot de passe incorrect.",
  introuvable: "Compte introuvable.",
  admin:
    "Un compte administrateur ne peut pas être supprimé directement : demandez à un autre administrateur de vous retirer d'abord ce rôle.",
  "deja-efface": "Ce compte a déjà été supprimé.",
  "solde-vendeur":
    "Vous avez encore de l'argent à recevoir en tant que vendeur. Demandez et recevez vos versements (page « Mes revenus »), ou contactez le support, avant de supprimer votre compte.",
  "versement-en-cours":
    "Vous avez un versement en cours de traitement. Attendez qu'il soit terminé avant de supprimer votre compte.",
};

export default async function SuppressionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireUser("/profil/suppression");

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
          <h1 className="mt-3 text-2xl font-bold">Supprimer mon compte</h1>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <section className="card border-yellow-200 bg-yellow-50 text-sm text-yellow-900">
          <p className="font-semibold">Avant de continuer</p>
          <p className="mt-1">
            Pensez à{" "}
            <Link
              href="/profil/donnees"
              className="font-semibold underline"
            >
              télécharger une copie de vos données
            </Link>{" "}
            et à télécharger vos ouvrages achetés depuis{" "}
            <Link href="/acheteur/commandes" className="font-semibold underline">
              Mes commandes
            </Link>
            . Après la suppression, ils ne seront plus accessibles.
          </p>
        </section>

        <section className="card text-sm text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Ce qui va se passer</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Votre nom, votre adresse email, votre téléphone et votre mot de passe sont effacés.
              Vous êtes déconnecté de tous vos appareils.
            </li>
            <li>
              Vos messages de contact et le contenu de vos conversations avec le support sont supprimés.
            </li>
            <li>
              Vos commandes passées sont conservées de façon anonyme (numéros, montants, dates) pour
              nos obligations comptables.{" "}
              <strong>
                Vous perdez l&apos;accès aux ouvrages que vous avez achetés : téléchargez-les avant de
                continuer.
              </strong>
            </li>
            {user.role === "SELLER" && (
              <li>
                Votre profil vendeur est effacé et vos ouvrages sont retirés de la vente. Les acheteurs
                qui les ont déjà achetés gardent leur accès. Vous ne pouvez pas supprimer votre compte
                tant qu&apos;il vous reste de l&apos;argent à recevoir.
              </li>
            )}
            <li>
              <strong>Cette action est irréversible.</strong> Vous pourrez créer un nouveau compte
              avec la même adresse email, mais sans retrouver aucune donnée.
            </li>
          </ul>
        </section>

        <section className="card border-red-200">
          <form action={deleteOwnAccountAction} className="space-y-4">
            <div>
              <label htmlFor="password" className="label">
                Votre mot de passe
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

            <div>
              <label htmlFor="confirmation" className="label">
                Pour confirmer, saisissez le mot SUPPRIMER
              </label>
              <input
                id="confirmation"
                name="confirmation"
                type="text"
                autoComplete="off"
                required
                className="input max-w-[12rem]"
              />
            </div>

            <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700">
              Supprimer définitivement mon compte
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
