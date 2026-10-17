// src/app/vendeur/export/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { quickPeriods } from "@/lib/csv";

export const metadata: Metadata = {
  title: "Exporter mes ventes",
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  compte: "Votre compte vendeur ne permet pas cette opération.",
  type: "Choisissez un rapport.",
  dates: "Dates invalides : saisissez une date de début et une date de fin.",
  ordre: "La date de fin doit être postérieure ou égale à la date de début.",
  periode: "La période ne peut pas dépasser 366 jours.",
  "trop-de-lignes": "Trop de lignes pour un seul fichier (20 000 au maximum) : réduisez la période.",
  limite: "Trop d'exports récents. Patientez 15 minutes avant d'en télécharger un autre.",
  technique: "Une erreur est survenue lors de la préparation du fichier. Réessayez dans un instant.",
};

function validDay(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export default async function VendeurExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const context = await loadSellerPage("/vendeur/export");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const periods = quickPeriods();
  const defaultFrom = validDay(firstParam(sp.du)) ?? periods[0].from;
  const defaultTo = validDay(firstParam(sp.au)) ?? periods[0].to;

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exporter mes ventes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Téléchargez vos ventes et vos versements au format CSV, lisible dans Excel, pour votre
          comptabilité ou votre déclaration.
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <h2 className="text-lg font-semibold">Choisir la période</h2>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {periods.map((period) => (
            <Link
              key={period.label}
              href={`/vendeur/export?du=${period.from}&au=${period.to}`}
              className="btn-secondary"
            >
              {period.label}
            </Link>
          ))}
        </div>

        <form method="get" action="/api/vendeur/export" className="mt-5 space-y-4">
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
              <option value="ventes">Mes ventes et mes gains</option>
              <option value="versements">Mes versements</option>
            </select>
          </div>

          <button type="submit" className="btn-primary">
            Télécharger le fichier CSV
          </button>
        </form>
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Ventes</strong> : une ligne par ouvrage vendu, avec le prix, la commission de la
            boutique et vos gains. Les ventes remboursées par la suite apparaissent avec le statut
            « Remboursée » : leurs gains ont été retirés de votre solde.
          </li>
          <li>
            <strong>Versements</strong> : vos demandes de versement, avec leurs dates, leur statut et
            la référence de la transaction.
          </li>
          <li>
            Les dates et heures sont en <strong>UTC</strong> (équivalent de l&apos;heure du Burkina
            Faso). Les montants en FCFA sont des nombres entiers.
          </li>
          <li>
            Le fichier utilise le point-virgule comme séparateur : il s&apos;ouvre directement dans
            Excel en français.
          </li>
          <li>
            Ces documents sont une aide : consultez votre comptable pour vos déclarations.
          </li>
        </ul>
      </section>
    </div>
  );
}
