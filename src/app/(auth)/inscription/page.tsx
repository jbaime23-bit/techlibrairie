// src/app/(auth)/inscription/page.tsx
// Choix de l'espace d'inscription : auteur (Édition), acheteur ou vendeur (Boutique).
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Inscription",
};

export default async function InscriptionPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Créer un compte</h1>
          <p className="mt-3 text-slate-600">Choisissez l&apos;espace qui correspond à votre démarche.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Link
            href="/edition/inscription"
            className="card card-hover flex flex-col border-brand-100 bg-gradient-to-br from-brand-50 to-white"
          >
            <p className="eyebrow text-brand-700">Édition</p>
            <h2 className="mt-2 text-xl font-extrabold">Je suis auteur</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Je veux faire éditer mon livre par TechLibrairie Édition.
            </p>
            <span className="mt-4 text-sm font-semibold text-brand-700">Créer mon espace auteur</span>
          </Link>

          <Link
            href="/boutique/acheteur/inscription"
            className="card card-hover flex flex-col border-teal-100 bg-gradient-to-br from-teal-50 to-white"
          >
            <p className="eyebrow text-teal-700">Boutique</p>
            <h2 className="mt-2 text-xl font-extrabold">Je suis acheteur</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Je veux acheter et télécharger des livres et guides en PDF.
            </p>
            <span className="mt-4 text-sm font-semibold text-teal-700">Créer mon compte acheteur</span>
          </Link>

          <Link
            href="/boutique/vendeur/inscription"
            className="card card-hover flex flex-col border-emerald-100 bg-gradient-to-br from-emerald-50 to-white"
          >
            <p className="eyebrow text-emerald-700">Boutique</p>
            <h2 className="mt-2 text-xl font-extrabold">Je suis vendeur</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Je veux mettre mes documents PDF en vente dans la boutique.
            </p>
            <span className="mt-4 text-sm font-semibold text-emerald-700">Créer mon compte vendeur</span>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-slate-600">
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-semibold text-brand-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
