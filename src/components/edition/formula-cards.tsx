// src/components/edition/formula-cards.tsx
// Les deux formules d'édition, côte à côte : à compte d'auteur et à compte d'éditeur.
import Link from "next/link";
import { formatXofAmount, type EditionOffers } from "@/lib/edition-offers";

function Check({ tone }: { tone: "brand" | "accent" }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-accent-100 text-accent-700"
      }`}
    >
      ✓
    </span>
  );
}

export function FormulaCards({ offers }: { offers: EditionOffers }) {
  const authorPoints = [
    "Contrôle de conformité, mise en page professionnelle et bon à tirer validé par vous",
    "Publication en PDF et en livre imprimé à la demande",
    "100 % du produit net de vos ventes, sans commission",
    "Vous gardez vos droits d'auteur (licence non exclusive)",
    "Frais d'impression déduits des ventes imprimées, jamais avancés",
    "Contrat signé en ligne, téléchargeable en PDF après le règlement du forfait",
  ];

  const publisherPoints = [
    "Aucun frais d'entrée : TechLibrairie finance l'édition si votre manuscrit est retenu",
    "Manuscrit examiné par notre équipe éditoriale : une sélection est opérée",
    "Mise en page, publication et fabrication à notre charge",
    `Redevance fixe sur chaque vente (indicatif : ${offers.publisherRoyaltyPercent} %), précisée dans le contrat d'édition`,
    "Contrat généré dès que votre manuscrit est retenu, signé en ligne et téléchargeable en PDF",
    "Aucune garantie d'acceptation : vous êtes informé de la décision par email",
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <article className="flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
        <div className="bg-gradient-to-br from-brand-900 via-brand-700 to-violet-700 p-6 text-white">
          <p className="eyebrow text-brand-200">Formule 1</p>
          <h3 className="mt-1 text-2xl font-extrabold">Édition à compte d&apos;auteur</h3>
          <p className="mt-2 text-sm font-medium text-brand-100">
            Vous financez l&apos;édition de votre livre, et vous gardez tout : vos droits et vos gains.
          </p>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <p className="text-3xl font-extrabold text-brand-800">
            {formatXofAmount(offers.authorFeeXof)}
            <span className="ml-2 text-base font-medium text-slate-500">par livre, une seule fois</span>
          </p>

          <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-700">
            {authorPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <Check tone="brand" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <Link href="/edition/deposer?formule=auteur" className="btn-primary mt-6 w-full">
            Choisir l&apos;édition à compte d&apos;auteur
          </Link>
          <Link
            href="/contrat-edition"
            className="mt-3 text-center text-sm font-semibold text-brand-700 hover:underline"
          >
            Lire le contrat
          </Link>
        </div>
      </article>

      <article className="flex flex-col overflow-hidden rounded-3xl border border-accent-100 bg-white shadow-soft">
        <div className="bg-gradient-to-br from-accent-700 via-accent-600 to-rose-600 p-6 text-white">
          <p className="eyebrow text-accent-100">Formule 2</p>
          <h3 className="mt-1 text-2xl font-extrabold">Édition à compte d&apos;éditeur</h3>
          <p className="mt-2 text-sm font-medium text-white">
            Nous investissons dans votre livre : vous n&apos;avancez rien, et vous êtes rémunéré sur chaque vente.
          </p>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <p className="text-3xl font-extrabold text-accent-700">
            0 FCFA
            <span className="ml-2 text-base font-medium text-slate-500">à l&apos;entrée</span>
          </p>

          <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-700">
            {publisherPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <Check tone="accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <Link href="/edition/deposer?formule=editeur" className="btn-accent mt-6 w-full">
            Soumettre mon manuscrit à l&apos;examen
          </Link>
          <Link
            href="/contrat-editeur"
            className="mt-3 text-center text-sm font-semibold text-accent-700 hover:underline"
          >
            Lire le modèle de contrat
          </Link>
        </div>
      </article>
    </div>
  );
}
