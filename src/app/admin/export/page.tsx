// src/app/admin/export/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, requireAdmin } from "@/lib/admin";
import { quickPeriods } from "@/lib/csv";

export const metadata: Metadata = {
  title: "Export comptable",
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  type: "Choisissez un rapport.",
  dates: "Dates invalides : saisissez une date de début et une date de fin.",
  ordre: "La date de fin doit être postérieure ou égale à la date de début.",
  periode: "La période ne peut pas dépasser 366 jours.",
  "trop-de-lignes": "Trop de lignes pour un seul fichier (20 000 au maximum) : réduisez la période.",
  technique: "Une erreur est survenue lors de la préparation du fichier. Réessayez dans un instant.",
};

const REPORTS = [
  {
    value: "ventes",
    label: "Ventes et commissions",
    description:
      "Une ligne par ouvrage vendu : date de paiement, commande, ouvrage, vendeur, prix catalogue, remise, prix payé, code promotionnel utilisé, taux et montant de la commission de la boutique, part du vendeur, statut (payée ou remboursée).",
  },
  {
    value: "remboursements",
    label: "Remboursements",
    description:
      "Une ligne par commande remboursée : date, prestataire, moyen de paiement, montant remboursé, mode, référence et motif.",
  },
  {
    value: "versements",
    label: "Versements aux vendeurs",
    description:
      "Une ligne par demande de versement : dates de demande et de versement, vendeur, montant, statut, opérateur, référence.",
  },
  {
    value: "support",
    label: "Support payant",
    description:
      "Une ligne par conversation de support payée : date, numéro, prestataire, moyen de paiement, montant, référence de transaction.",
  },
] as const;

function validDay(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export default async function AdminExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/export");

  const periods = quickPeriods();
  const defaultFrom = validDay(firstParam(sp.du)) ?? periods[0].from;
  const defaultTo = validDay(firstParam(sp.au)) ?? periods[0].to;

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export comptable</h1>
        <p className="mt-1 text-sm text-slate-600">
          Téléchargez vos chiffres au format CSV, lisible dans Excel, pour votre comptable ou
          votre déclaration.
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <h2 className="text-lg font-semibold">Choisir la période</h2>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {periods.map((period) => (
            <Link
              key={period.label}
              href={`/admin/export?du=${period.from}&au=${period.to}`}
              className="btn-secondary"
            >
              {period.label}
            </Link>
          ))}
        </div>

        <form method="get" action="/api/admin/export" className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="from" className="label">
                Du
              </label>
              <input
                id="from"
                name="from"
                type="date"
                required
                defaultValue={defaultFrom}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="to" className="label">
                Au (inclus)
              </label>
              <input
                id="to"
                name="to"
                type="date"
                required
                defaultValue={defaultTo}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="type" className="label">
              Rapport
            </label>
            <select id="type" name="type" required defaultValue="ventes" className="input">
              {REPORTS.map((report) => (
                <option key={report.value} value={report.value}>
                  {report.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary">
            Télécharger le fichier CSV
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Contenu des rapports</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {REPORTS.map((report) => (
            <div key={report.value}>
              <dt className="font-semibold">{report.label}</dt>
              <dd className="text-slate-600">{report.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Les dates et heures sont en <strong>UTC</strong> (équivalent de l&apos;heure du Burkina
            Faso). Les ventes sont placées à leur <strong>date de paiement</strong>.
          </li>
          <li>
            Dans le rapport des ventes, <strong>« Prix payé » est la colonne à additionner</strong> :
            c&apos;est l&apos;argent réellement encaissé, remise déduite. Le « Prix catalogue » et la
            « Remise » servent à suivre vos promotions. Pour les ventes antérieures aux codes
            promotionnels, le prix catalogue est égal au prix payé.
          </li>
          <li>
            Le taux de commission indiqué est le taux <strong>effectif</strong> de la ligne : avec un
            code « Boutique seule », il peut être inférieur au taux normal du vendeur.
          </li>
          <li>
            Le rapport des ventes contient aussi les commandes <strong>remboursées par la suite</strong>,
            avec le statut « Remboursée » : filtrez cette colonne avant de faire des totaux, ou
            utilisez le rapport des remboursements pour les déduire.
          </li>
          <li>
            Les montants en FCFA sont des nombres entiers. Les montants en euros ou en dollars (cas
            des anciens ouvrages) sont indiqués avec leur devise.
          </li>
          <li>
            Aucune adresse email ni aucun numéro de téléphone n&apos;est exporté : les commandes sont
            identifiées par leur numéro.
          </li>
          <li>
            Le fichier utilise le point-virgule comme séparateur : il s&apos;ouvre directement dans
            Excel en français. Dans un autre tableur, choisissez le séparateur « point-virgule » et
            l&apos;encodage UTF-8 à l&apos;importation.
          </li>
          <li>
            Chaque export est enregistré dans le <Link href="/admin/journal" className="font-semibold text-brand-700 hover:underline">Journal</Link>.
            Les fichiers contiennent des données financières : ne les envoyez qu&apos;à des personnes
            de confiance.
          </li>
          <li>
            Ces documents sont une aide : la valeur comptable et fiscale de vos déclarations reste à
            valider avec votre comptable.
          </li>
        </ul>
      </section>
    </div>
  );
        }
