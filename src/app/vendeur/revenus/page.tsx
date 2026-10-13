// src/app/vendeur/revenus/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import {
  cancelPayoutAction,
  requestPayoutAction,
  savePayoutDetailsAction,
} from "@/app/vendeur/revenus/actions";
import {
  PAYOUT_HOLD_DAYS,
  PAYOUT_OPERATORS,
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_STYLES,
  formatMobileNumber,
  getSellerBalanceXof,
  operatorLabel,
} from "@/lib/payouts";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mes revenus",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "destination-enregistree": "Vos coordonnées de versement ont été enregistrées.",
  "demande-creee":
    "Votre demande de versement a été enregistrée. Elle sera traitée par l'équipe TechLibrairie.",
  "demande-annulee": "Votre demande de versement a été annulée.",
};

export default async function RevenusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const context = await loadSellerPage("/vendeur/revenus");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const { seller } = context;

  const [balance, settings, payouts, otherCurrencies] = await Promise.all([
    getSellerBalanceXof(seller.id),
    prisma.platformSetting.findUnique({
      where: { id: "global" },
      select: { minPayoutAmountXof: true },
    }),
    prisma.payout.findMany({
      where: { sellerId: seller.id },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
    prisma.orderItem.groupBy({
      by: ["currency"],
      where: {
        sellerId: seller.id,
        currency: { not: "XOF" },
        order: { status: "PAID" },
      },
      _sum: { sellerAmount: true },
    }),
  ]);

  const minimum = settings?.minPayoutAmountXof ?? 5000;
  const hasDestination = Boolean(seller.payoutMobileNumber && seller.payoutMobileOperator);
  const hasOpenRequest = payouts.some(
    (payout) => payout.status === "PENDING" || payout.status === "PROCESSING"
  );
  const canRequest =
    hasDestination && !hasOpenRequest && balance.available >= Math.max(minimum, 1);

  const ERRORS: Record<string, string> = {
    compte: "Votre compte vendeur ne permet pas cette opération.",
    montant: "Montant invalide : saisissez un nombre entier de FCFA.",
    destination: "Enregistrez d'abord votre numéro Orange Money ou Moov Money.",
    minimum: `Le montant minimum d'un versement est de ${formatPrice(minimum, "XOF")}.`,
    insuffisant: "Montant supérieur à votre solde disponible.",
    "en-cours": "Une demande de versement est déjà en cours de traitement.",
    technique: "Une erreur est survenue. Veuillez réessayer dans un instant.",
    operateur: "Choisissez Orange Money ou Moov Money.",
    numero:
      "Numéro invalide : saisissez 8 chiffres (Burkina Faso) ou un numéro international avec l'indicatif du pays.",
    "mot-de-passe": "Mot de passe incorrect.",
    introuvable: "Demande introuvable ou déjà prise en charge.",
  };

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Mes revenus</h1>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card border-brand-200 bg-brand-50">
          <p className="text-sm text-slate-600">Solde disponible</p>
          <p className="mt-1 text-2xl font-bold text-brand-800">
            {formatPrice(balance.available, "XOF")}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">En attente de déblocage</p>
          <p className="mt-1 text-2xl font-bold">{formatPrice(balance.onHold, "XOF")}</p>
          <p className="text-xs text-slate-500">
            Disponible {PAYOUT_HOLD_DAYS} jours après chaque vente
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Demande en cours</p>
          <p className="mt-1 text-2xl font-bold">{formatPrice(balance.open, "XOF")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Déjà versé</p>
          <p className="mt-1 text-2xl font-bold">{formatPrice(balance.paid, "XOF")}</p>
        </div>
      </div>

      {otherCurrencies.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50 text-sm text-yellow-900">
          <p className="font-semibold">Gains dans une autre devise</p>
          <p className="mt-1">
            Vous avez des gains en{" "}
            {otherCurrencies
              .map((row) => formatPrice(row._sum.sellerAmount ?? 0, row.currency))
              .join(", ")}
            . Ils ne peuvent pas être retirés ici : contactez le support.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-lg font-semibold">Coordonnées de versement</h2>

          {hasDestination && seller.payoutMobileNumber ? (
            <p className="mt-2 text-sm text-slate-700">
              Actuellement : {operatorLabel(seller.payoutMobileOperator)} ·{" "}
              <strong>{formatMobileNumber(seller.payoutMobileNumber)}</strong>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Aucun numéro enregistré. Les versements se font par Orange Money ou
              Moov Money.
            </p>
          )}

          <form action={savePayoutDetailsAction} className="mt-4 space-y-3">
            <div>
              <label htmlFor="operator" className="label">
                Opérateur
              </label>
              <select
                id="operator"
                name="operator"
                defaultValue={seller.payoutMobileOperator ?? "ORANGE_MONEY"}
                className="input"
              >
                {PAYOUT_OPERATORS.map((operator) => (
                  <option key={operator.value} value={operator.value}>
                    {operator.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mobileNumber" className="label">
                Numéro de téléphone
              </label>
              <input
                id="mobileNumber"
                name="mobileNumber"
                type="tel"
                required
                placeholder="70 00 00 00"
                className="input"
              />
              <p className="mt-1 text-xs text-slate-500">
                8 chiffres pour le Burkina Faso, ou numéro international avec
                l&apos;indicatif du pays.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Votre mot de passe (sécurité)
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

            <button type="submit" className="btn-secondary">
              Enregistrer
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">Demander un versement</h2>

          {canRequest ? (
            <form action={requestPayoutAction} className="mt-4 space-y-3">
              <div>
                <label htmlFor="amount" className="label">
                  Montant en FCFA (minimum {formatPrice(minimum, "XOF")})
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  inputMode="numeric"
                  min={Math.max(minimum, 1)}
                  max={balance.available}
                  step="1"
                  defaultValue={balance.available}
                  required
                  className="input"
                />
              </div>
              <p className="text-xs text-slate-500">
                Le versement sera envoyé sur{" "}
                {operatorLabel(seller.payoutMobileOperator)}{" "}
                {seller.payoutMobileNumber
                  ? formatMobileNumber(seller.payoutMobileNumber)
                  : ""}
                .
              </p>
              <button type="submit" className="btn-primary">
                Demander le versement
              </button>
            </form>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {!hasDestination && (
                <p>Enregistrez d&apos;abord votre numéro Orange Money ou Moov Money.</p>
              )}
              {hasOpenRequest && (
                <p>
                  Une demande est déjà en cours. Vous pourrez en faire une autre
                  une fois qu&apos;elle sera traitée.
                </p>
              )}
              {hasDestination && !hasOpenRequest && (
                <p>
                  Votre solde disponible est inférieur au minimum de versement (
                  {formatPrice(minimum, "XOF")}).
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">Historique des versements</h2>

        {payouts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Aucune demande de versement.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold">{formatPrice(payout.amount, payout.currency)}</p>
                  <p className="text-xs text-slate-500">
                    Demandé le {formatDate(payout.requestedAt)}
                    {payout.paidAt ? ` · versé le ${formatDate(payout.paidAt)}` : ""}
                    {payout.reference ? ` · référence ${payout.reference}` : ""}
                  </p>
                  {payout.note && (
                    <p className="text-xs text-slate-400">{payout.note}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${PAYOUT_STATUS_STYLES[payout.status]}`}
                  >
                    {PAYOUT_STATUS_LABELS[payout.status]}
                  </span>

                  {payout.status === "PENDING" && (
                    <form action={cancelPayoutAction}>
                      <input type="hidden" name="payoutId" value={payout.id} />
                      <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                        Annuler
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
