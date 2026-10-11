// src/app/page.tsx
import Link from "next/link";

export default function HomePage({
  searchParams,
}: {
  searchParams: { erreur?: string | string[] };
}) {
  const accessDenied = searchParams.erreur === "acces-refuse";

  return (
    <div className="container-page py-12">
      {accessDenied && (
        <div className="alert-error mb-8">
          Vous n&apos;avez pas l&apos;autorisation d&apos;accéder à cette page.
        </div>
      )}

      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Les meilleurs livres et guides techniques en PDF
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Achetez et téléchargez immédiatement des ressources écrites par des
          auteurs et éditeurs passionnés. Paiement par carte bancaire ou Mobile
          Money.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/catalogue" className="btn-primary">
            Parcourir le catalogue
          </Link>
          <Link href="/inscription" className="btn-secondary">
            Devenir vendeur
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <div className="card">
          <h2 className="text-lg font-semibold">Téléchargement immédiat</h2>
          <p className="mt-2 text-sm text-slate-600">
            Dès votre paiement confirmé, votre PDF est disponible au
            téléchargement, via un lien sécurisé personnel.
          </p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold">Deux moyens de paiement</h2>
          <p className="mt-2 text-sm text-slate-600">
            Cartes bancaires Visa et MasterCard, ou Mobile Money pour l&apos;Afrique
            de l&apos;Ouest et le Burkina Faso.
          </p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold">Publiez vos ouvrages</h2>
          <p className="mt-2 text-sm text-slate-600">
            Auteurs et éditeurs : soumettez vos PDF, ils sont publiés
            automatiquement et vous suivez vos ventes en temps réel.
          </p>
        </div>
      </section>
    </div>
  );
}
