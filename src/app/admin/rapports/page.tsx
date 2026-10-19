// src/app/admin/rapports/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, requireAdmin } from "@/lib/admin";
import { emailReportAction } from "@/app/admin/rapports/actions";
import {
  buildMonthlyReport,
  exportRange,
  parseMonthKey,
  previousMonth,
  recentMonths,
  variationLabel,
} from "@/lib/monthly-report";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Rapports mensuels",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  envoye: "Le rapport vous a été envoyé par email.",
};

const ERRORS: Record<string, string> = {
  mois: "Mois invalide.",
  email: "L'envoi d'emails n'est pas configuré : voir la page Emails.",
  limite: "Trop d'envois récents. Patientez 15 minutes avant de réessayer.",
  envoi: "L'email n'a pas pu être envoyé. Vérifiez la page Emails.",
};

function Variation({ current, previous }: { current: number; previous: number }) {
  const label = variationLabel(current, previous);
  if (!label) return null;

  const positive = label.startsWith("+") || label === "nouveau";
  const negative = label.startsWith("-");

  return (
    <span
      className={`ml-2 text-xs font-semibold ${
        positive ? "text-green-700" : negative ? "text-red-700" : "text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}

export default async function AdminRapportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/rapports");

  const now = new Date();
  const month = parseMonthKey(firstParam(sp.mois), now) ?? previousMonth(now);
  const months = recentMonths(13, now);

  const report = await buildMonthlyReport(month, now);
  const range = exportRange(month, now);

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  const { totals, previous } = report;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rapports mensuels</h1>
        <p className="mt-1 text-sm text-slate-600">
          Le rapport du mois précédent est envoyé automatiquement par email aux administrateurs, en
          début de mois. Vous pouvez relire ici n&apos;importe quel mois récent.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <div className="flex flex-wrap gap-2 text-sm">
        {months.map((item) => (
          <Link
            key={item.key}
            href={`/admin/rapports?mois=${item.key}`}
            className={item.key === month.key ? "btn-primary" : "btn-secondary"}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold capitalize">{month.label}</h2>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/export?du=${range.from}&au=${range.to}`}
            className="btn-secondary"
          >
            Exporter ce mois (comptabilité)
          </Link>

          <form action={emailReportAction}>
            <input type="hidden" name="mois" value={month.key} />
            <button type="submit" className="btn-secondary">
              Me l&apos;envoyer par email
            </button>
          </form>
        </div>
      </div>

      {report.isPartial && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          Ce mois n&apos;est pas terminé : les chiffres sont provisoires.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card">
          <p className="text-sm text-slate-600">Commandes payées</p>
          <p className="mt-1 text-2xl font-bold">
            {totals.orders}
            <Variation current={totals.orders} previous={previous.orders} />
          </p>
          <p className="text-xs text-slate-500">{totals.items} ouvrage(s) vendu(s)</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Chiffre d&apos;affaires</p>
          <p className="mt-1 text-xl font-bold">
            {formatPrice(totals.revenue, "XOF")}
          </p>
          <p className="text-xs">
            <Variation current={totals.revenue} previous={previous.revenue} />
          </p>
        </div>
        <div className="card border-brand-200 bg-brand-50">
          <p className="text-sm text-slate-600">Commission boutique</p>
          <p className="mt-1 text-xl font-bold text-brand-800">
            {formatPrice(totals.commission, "XOF")}
          </p>
          <p className="text-xs">
            <Variation current={totals.commission} previous={previous.commission} />
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Part des vendeurs</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(totals.sellerShare, "XOF")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Panier moyen</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(report.averageBasket, "XOF")}</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Variations par rapport à {report.previousLabel}.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-lg font-semibold">Argent</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Remises accordées (codes promotionnels)</dt>
              <dd className="font-medium">{formatPrice(totals.discount, "XOF")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Paiements par Mobile Money</dt>
              <dd className="font-medium">{report.paymentsByMethod.mobileMoney}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Paiements par carte</dt>
              <dd className="font-medium">{report.paymentsByMethod.card}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Remboursements du mois</dt>
              <dd className="font-medium">
                {report.refunds.count} ({formatPrice(report.refunds.amountXof, "XOF")})
              </dd>
            </div>
            {report.refunds.otherCurrency > 0 && (
              <p className="text-xs text-slate-500">
                Plus {report.refunds.otherCurrency} remboursement(s) en devise étrangère, non
                totalisé(s).
              </p>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Support payant</dt>
              <dd className="font-medium">
                {report.support.count} ({formatPrice(report.support.amount, "XOF")})
              </dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">Vendeurs et activité</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Versements effectués</dt>
              <dd className="font-medium">
                {report.payouts.paidCount} ({formatPrice(report.payouts.paidAmount, "XOF")})
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Demandes de versement reçues</dt>
              <dd className="font-medium">{report.payouts.requestedCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Reste dû aux vendeurs (aujourd&apos;hui)</dt>
              <dd className="font-medium">{formatPrice(report.payouts.owedNow, "XOF")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Nouveaux acheteurs</dt>
              <dd className="font-medium">{report.newAccounts.buyers}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Nouveaux vendeurs</dt>
              <dd className="font-medium">{report.newAccounts.sellers}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Ouvrages publiés</dt>
              <dd className="font-medium">{report.newProducts}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Avis reçus</dt>
              <dd className="font-medium">{report.newReviews}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-lg font-semibold">Ouvrages les plus vendus</h2>

          {report.topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aucune vente ce mois-ci.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {report.topProducts.map((product) => (
                <li key={product.title} className="flex justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{product.title}</p>
                    <p className="text-xs text-slate-500">{product.sales} vente(s)</p>
                  </div>
                  <p className="font-semibold">{formatPrice(product.revenue, "XOF")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">Vendeurs les plus actifs</h2>

          {report.topSellers.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aucune vente ce mois-ci.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {report.topSellers.map((seller) => (
                <li key={seller.name} className="flex justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{seller.name}</p>
                    <p className="text-xs text-slate-500">
                      {seller.sales} vente(s) · commission {formatPrice(seller.commission, "XOF")}
                    </p>
                  </div>
                  <p className="font-semibold">{formatPrice(seller.revenue, "XOF")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {report.topPromos.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold">Codes promotionnels les plus utilisés</h2>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {report.topPromos.map((promo) => (
              <li key={promo.code} className="flex justify-between gap-3 py-2">
                <div>
                  <p className="font-mono font-semibold">{promo.code}</p>
                  <p className="text-xs text-slate-500">{promo.uses} utilisation(s)</p>
                </div>
                <p className="font-semibold">{formatPrice(promo.discount, "XOF")} de remises</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Les ventes comptent les commandes <strong>payées et non remboursées</strong>, à leur date
            de paiement, en FCFA. Les jours sont calculés en heure UTC (équivalente à l&apos;heure du
            Burkina Faso).
          </li>
          <li>
            Les remboursements sont comptés <strong>le mois où ils ont lieu</strong>, même pour une
            commande payée un mois plus tôt.
          </li>
          <li>
            Cette page recalcule les chiffres en direct : un remboursement tardif peut modifier un mois
            passé, alors que l&apos;email déjà envoyé en reste la photographie du jour.
          </li>
          {report.otherCurrencySales > 0 && (
            <li>
              {report.otherCurrencySales} vente(s) en devise étrangère ne sont pas comptées dans les
              totaux en FCFA.
            </li>
          )}
          <li>
            Pour les chiffres à transmettre à votre comptable, utilisez l&apos;export comptable : ce
            rapport est une synthèse de pilotage, pas un document comptable.
          </li>
        </ul>
      </section>
    </div>
  );
}
