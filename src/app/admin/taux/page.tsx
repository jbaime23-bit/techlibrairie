// src/app/admin/taux/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import { setExchangeRateAction } from "@/app/admin/taux/actions";
import {
  FOREIGN_CURRENCIES,
  MAX_RATE_AGE_DAYS,
  RATE_BOUNDS,
  convertXofToMinor,
  formatRateMicro,
  getCardRate,
  type ForeignCurrency,
} from "@/lib/fx";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Taux de change",
};

export const dynamic = "force-dynamic";

const CURRENCY_NAMES: Record<ForeignCurrency, string> = {
  EUR: "Euro (EUR)",
  USD: "Dollar US (USD)",
};

const MESSAGES: Record<string, string> = {
  "enregistre-EUR": "Taux de l'euro enregistré.",
  "enregistre-USD": "Taux du dollar enregistré.",
};

const ERRORS: Record<string, string> = {
  devise: "Devise invalide.",
  taux: "Taux invalide : saisissez un nombre positif (6 décimales au maximum).",
  "bornes-EUR": `Taux de l'euro refusé : il doit être compris entre ${RATE_BOUNDS.EUR.min} et ${RATE_BOUNDS.EUR.max} FCFA.`,
  "bornes-USD": `Taux du dollar refusé : il doit être compris entre ${RATE_BOUNDS.USD.min} et ${RATE_BOUNDS.USD.max} FCFA.`,
};

export default async function AdminTauxPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/taux");

  const [history, eurRate, usdRate] = await Promise.all([
    prisma.exchangeRate.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getCardRate("EUR"),
    getCardRate("USD"),
  ]);

  const rates = { EUR: eurRate, USD: usdRate };

  const messageKey = firstParam(searchParams.message);
  const errorKey = firstParam(searchParams.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Taux de change</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les prix sont en FCFA. Pour un paiement par carte bancaire, le montant
          est converti avec le taux le plus récent, marge de conversion incluse
          (réglable dans{" "}
          <Link href="/admin/parametres" className="text-brand-700 hover:underline">
            Paramètres
          </Link>
          ).
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      {FOREIGN_CURRENCIES.map((currency) => {
        const rate = rates[currency];
        const latest = history.find((row) => row.currency === currency);
        const bounds = RATE_BOUNDS[currency];

        return (
          <section key={currency} className="card">
            <h2 className="text-lg font-semibold">{CURRENCY_NAMES[currency]}</h2>

            {rate ? (
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  Taux publié : <strong>1 {currency} = {formatRateMicro(rate.baseRateMicro)} FCFA</strong>{" "}
                  ({rate.source}
                  {rate.updatedAt ? `, saisi le ${formatDate(rate.updatedAt)}` : ""})
                </p>
                <p>
                  Taux appliqué aux clients (marge de {rate.marginBps / 100} % incluse) :{" "}
                  <strong>1 {currency} = {formatRateMicro(rate.effectiveRateMicro)} FCFA</strong>
                </p>
                <p className="text-slate-600">
                  Exemple : 10 000 FCFA seront débités{" "}
                  {formatPrice(convertXofToMinor(10000, rate), currency)}.
                </p>
              </div>
            ) : (
              <div className="alert-error mt-3">
                Le paiement par carte en {currency === "EUR" ? "euros" : "dollars"} n&apos;est{" "}
                <strong>pas proposé</strong> :{" "}
                {latest
                  ? `le dernier taux (${formatDate(latest.createdAt)}) a plus de ${MAX_RATE_AGE_DAYS} jours.`
                  : "aucun taux n'a été saisi."}{" "}
                Saisissez le taux du jour ci-dessous.
              </div>
            )}

            <form
              action={setExchangeRateAction}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="currency" value={currency} />
              <div>
                <label htmlFor={`rate-${currency}`} className="label">
                  Nouveau taux : FCFA pour 1 {currency}
                </label>
                <input
                  id={`rate-${currency}`}
                  name="rate"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder={currency === "EUR" ? "655.957" : "600"}
                  className="input w-48"
                />
              </div>
              <button type="submit" className="btn-primary">
                Enregistrer
              </button>
            </form>
            <p className="mt-2 text-xs text-slate-500">
              Valeur acceptée : entre {bounds.min} et {bounds.max}.
              {currency === "EUR"
                ? " Le franc CFA est lié à l'euro par une parité fixe de 655,957 : elle est utilisée par défaut, vous n'avez rien à saisir."
                : ` Un taux de plus de ${MAX_RATE_AGE_DAYS} jours est automatiquement ignoré et le paiement en dollars est alors suspendu.`}
            </p>
          </section>
        );
      })}

      <section className="card">
        <h2 className="text-lg font-semibold">Historique des taux saisis</h2>

        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Aucun taux saisi pour le moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Devise</th>
                  <th className="py-2 font-medium">FCFA pour 1 unité</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{formatDate(row.createdAt)}</td>
                    <td className="py-2 pr-4">{row.currency}</td>
                    <td className="py-2">
                      {row.xofPerUnit.toNumber().toLocaleString("fr-FR", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 6,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
            }
