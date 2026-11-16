// src/app/edition/page.tsx
// Page de la maison d'édition : les deux formules, la comparaison, les étapes, les formats et les questions.
import type { Metadata } from "next";
import Link from "next/link";
import { FormulaCards } from "@/components/edition/formula-cards";
import { ProcessSteps } from "@/components/edition/process-steps";
import { formatXofAmount, getEditionOffers } from "@/lib/edition-offers";

export const metadata: Metadata = {
  title: "TechLibrairie Édition : faites éditer votre livre",
  description:
    "Deux formules d'édition : à compte d'auteur (vous financez, vous gardez tout) ou à compte d'éditeur (nous investissons, vous êtes rémunéré sur chaque vente). Publication en PDF et en livre imprimé à la demande.",
  alternates: { canonical: "/edition" },
};

export const dynamic = "force-dynamic";

const FORM_STEPS = [
  { title: "Le titre", text: "Le nom de votre livre." },
  { title: "Le résumé", text: "La description qui donnera envie de vous lire." },
  { title: "Le manuscrit", text: "Votre fichier PDF, à déposer en toute sécurité." },
  { title: "La couverture", text: "Votre image de couverture, ou un choix de couverture." },
];

export default function EditionPage() {
  const offers = getEditionOffers();

  const rows: { label: string; author: string; publisher: string }[] = [
    {
      label: "Qui finance l'édition ?",
      author: "L'auteur",
      publisher: "TechLibrairie Édition, si le manuscrit est retenu",
    },
    {
      label: "Coût à l'entrée",
      author: `${formatXofAmount(offers.authorFeeXof)} par livre`,
      publisher: "0 FCFA",
    },
    {
      label: "Sélection du manuscrit",
      author: "Contrôle de conformité légale",
      publisher: "Examen éditorial : le manuscrit peut être refusé",
    },
    {
      label: "Vos droits d'auteur",
      author: "Vous les gardez (licence non exclusive)",
      publisher: "Précisés dans le contrat d'édition",
    },
    {
      label: "Vos gains",
      author: "100 % du produit net de vos ventes",
      publisher: `Redevance sur chaque vente (indicatif : ${offers.publisherRoyaltyPercent} %)`,
    },
    {
      label: "Impression à la demande",
      author: "Frais déduits de chaque vente imprimée",
      publisher: "À la charge de TechLibrairie Édition, selon le contrat",
    },
    {
      label: "Contrat",
      author: "Contrat à compte d'auteur, accepté en ligne",
      publisher: "Contrat d'édition proposé aux manuscrits retenus",
    },
  ];

  const faq: { question: string; answer: string }[] = [
    {
      question: "Quelle différence entre les deux formules ?",
      answer:
        "À compte d'auteur, vous financez l'édition de votre livre par un forfait et vous gardez vos droits et tous vos gains. À compte d'éditeur, c'est TechLibrairie Édition qui finance l'édition d'un manuscrit qu'elle a retenu, et vous percevez une redevance sur chaque vente.",
    },
    {
      question: "Combien coûte l'édition à compte d'auteur ?",
      answer: `Un forfait de ${formatXofAmount(offers.authorFeeXof)} par nouveau livre, payé une seule fois par Mobile Money après le dépôt. Il couvre le contrôle, la mise en page et la publication. Les frais d'impression d'un exemplaire imprimé sont déduits de chaque vente, sans avance de votre part.`,
    },
    {
      question: "Vais-je garder mes droits d'auteur ?",
      answer:
        "À compte d'auteur, oui : vous restez seul titulaire de vos droits et vous nous accordez seulement une licence non exclusive pour publier et vendre votre livre. À compte d'éditeur, les droits cédés sont précisés dans le contrat d'édition.",
    },
    {
      question: "Mon manuscrit peut-il être refusé ?",
      answer:
        "Oui. À compte d'éditeur, une sélection est opérée. À compte d'auteur, nous contrôlons la conformité légale (contenu licite, droits). Si vous avez déjà payé le forfait et que votre livre est refusé, il vous est remboursé intégralement.",
    },
    {
      question: "Comment fonctionne l'impression ?",
      answer:
        "Chaque exemplaire imprimé est fabriqué à la commande, sans stock. Le lecteur paie la livraison en plus du prix du livre. La fabrication est assurée par un prestataire d'impression à la demande.",
    },
    {
      question: "Puis-je lire le contrat avant de m'engager ?",
      answer:
        "Oui : le contrat à compte d'auteur est consultable avant tout dépôt. Pour la formule à compte d'éditeur, le contrat d'édition vous est proposé si votre manuscrit est retenu.",
    },
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-violet-700 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent-500/30 blur-3xl" />
        <div className="container-page relative py-14 sm:py-20">
          <p className="eyebrow text-accent-300">TechLibrairie Édition</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold sm:text-5xl">Faites éditer votre livre</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100">
            Deux formules pour être publié, une seule exigence : un livre bien fait. Mise en page
            professionnelle, publication en PDF et en livre imprimé à la demande.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/edition/deposer" className="btn-accent px-6 py-3 text-base">
              Déposer mon manuscrit
            </Link>
            <Link href="#formules" className="btn-outline-light px-6 py-3 text-base">
              Comparer les formules
            </Link>
          </div>
        </div>
      </section>

      <section id="formules" className="container-page scroll-mt-28 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-brand-700">Nos deux formules</p>
          <h2 className="mt-2 text-3xl font-extrabold">Vous choisissez la façon d&apos;être publié</h2>
        </div>

        <div className="mt-10">
          <FormulaCards offers={offers} />
        </div>

        <div className="mt-12 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Comparaison des deux formules d&apos;édition</caption>
            <thead>
              <tr className="text-white">
                <th className="bg-slate-800 px-5 py-4 font-semibold">En un coup d&apos;œil</th>
                <th className="bg-brand-700 px-5 py-4 font-semibold">À compte d&apos;auteur</th>
                <th className="bg-accent-700 px-5 py-4 font-semibold">À compte d&apos;éditeur</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.label} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <th scope="row" className="px-5 py-3 font-semibold text-slate-800">
                    {row.label}
                  </th>
                  <td className="px-5 py-3 text-slate-700">{row.author}</td>
                  <td className="px-5 py-3 text-slate-700">{row.publisher}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-slate-500">
          La redevance indiquée pour la formule à compte d&apos;éditeur est un ordre de grandeur : elle est fixée
          dans le contrat d&apos;édition. TechLibrairie Édition ne garantit aucune vente.
        </p>
      </section>

      <section id="etapes" className="scroll-mt-28 bg-white py-14">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-brand-700">Comment ça marche</p>
            <h2 className="mt-2 text-3xl font-extrabold">Un dépôt simple, une étape à la fois</h2>
            <p className="mt-3 text-slate-600">
              Notre formulaire vous guide pas à pas : une seule question par écran, un bouton « Suivant ».
            </p>
          </div>

          <ol className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FORM_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center"
              >
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-extrabold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-bold text-brand-900">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12">
            <ProcessSteps />
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card card-hover">
            <p className="eyebrow text-brand-700">Format numérique</p>
            <h3 className="mt-2 text-xl font-bold">PDF téléchargeable</h3>
            <p className="mt-2 text-sm text-slate-600">
              Votre livre est mis en vente en PDF dans la boutique TechLibrairie, téléchargeable immédiatement
              après paiement par un lien sécurisé personnel.
            </p>
          </div>
          <div className="card card-hover">
            <p className="eyebrow text-accent-700">Format imprimé</p>
            <h3 className="mt-2 text-xl font-bold">Livre imprimé à la demande</h3>
            <p className="mt-2 text-sm text-slate-600">
              Chaque exemplaire est fabriqué à la commande, sans stock. Vous fixez votre prix, sans pouvoir
              descendre sous le prix plancher qui couvre la fabrication.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="container-page max-w-3xl">
          <div className="text-center">
            <p className="eyebrow text-brand-700">Questions fréquentes</p>
            <h2 className="mt-2 text-3xl font-extrabold">Vos questions, nos réponses</h2>
          </div>

          <div className="mt-8 space-y-3">
            {faq.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 open:border-brand-200 open:bg-white open:shadow-sm"
              >
                <summary className="cursor-pointer list-none font-semibold text-slate-900">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span aria-hidden="true" className="text-brand-600 transition group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="rounded-3xl bg-gradient-to-r from-brand-700 via-violet-700 to-fuchsia-600 p-8 text-center text-white sm:p-12">
          <h2 className="text-3xl font-extrabold">Votre livre commence ici</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Choisissez votre formule et déposez votre projet.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/edition/deposer?formule=auteur" className="btn-light px-6 py-3 text-base">
              À compte d&apos;auteur
            </Link>
            <Link href="/edition/deposer?formule=editeur" className="btn-accent px-6 py-3 text-base">
              À compte d&apos;éditeur
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
                 }
