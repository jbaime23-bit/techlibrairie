// src/app/admin/versements/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { PayoutStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import {
  markPayoutPaidAction,
  rejectPayoutAction,
  startPayoutAction,
} from "@/app/admin/versements/actions";
import {
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_STYLES,
  formatMobileNumber,
  operatorLabel,
} from "@/lib/payouts";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Versements",
};

export const dynamic = "force-dynamic";

type Filter = "OPEN" | "PAID" | "FAILED" | "ALL";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "OPEN", label: "À traiter" },
  { value: "PAID", label: "Versés" },
  { value: "FAILED", label: "Refusés ou annulés" },
  { value: "ALL", label: "Tous" },
];

const MESSAGES: Record<string, string> = {
  "pris-en-charge": "Demande prise en charge.",
  paye: "Versement marqué comme payé.",
  refuse: "Demande refusée : les fonds sont de nouveau disponibles pour le vendeur.",
};

const ERRORS: Record<string, string> = {
  introuvable: "Demande introuvable.",
  etat: "Cette demande a déjà été traitée ou n'est plus dans l'état attendu.",
  reference:
    "Référence invalide : saisissez la référence de la transaction (3 à 100 caractères : lettres, chiffres, espaces, tirets).",
  motif: "Indiquez un motif de refus (3 caractères au minimum).",
};

export default async function AdminVersementsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/versements");

  const rawFilter = firstParam(searchParams.statut);
  const filter: Filter =
    FILTERS.find((option) => option.value === rawFilter)?.value ?? "OPEN";

  const statuses: PayoutStatus[] | null =
    filter === "OPEN"
      ? ["PENDING", "PROCESSING"]
      : filter === "PAID"
        ? ["PAID"]
        : filter === "FAILED"
          ? ["FAILED"]
          : null;

  const where: Prisma.PayoutWhereInput = {
    currency: "XOF",
    ...(statuses ? { status: { in: statuses } } : {}),
  };

  const total = await prisma.payout.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(searchParams.page), totalPages);

  const [payouts, earnedBySeller, payoutsBySeller, payoutTotals] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: { requestedAt: filter === "OPEN" ? "asc" : "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        seller: {
          select: { displayName: true, user: { select: { email: true } } },
        },
      },
    }),
    prisma.orderItem.groupBy({
      by: ["sellerId"],
      where: { currency: "XOF", order: { status: "PAID" } },
      _sum: { sellerAmount: true },
    }),
    prisma.payout.groupBy({
      by: ["sellerId", "status"],
      where: { currency: "XOF", status: { not: "FAILED" } },
      _sum: { amount: true },
    }),
    prisma.payout.groupBy({
      by: ["status"],
      where: { currency: "XOF" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  // Soldes par vendeur : gains moins versements (payés ou demandés)
  const committedBySeller = new Map<string, { paid: number; open: number }>();
  for (const row of payoutsBySeller) {
    const entry = committedBySeller.get(row.sellerId) ?? { paid: 0, open: 0 };
    if (row.status === "PAID") entry.paid += row._sum.amount ?? 0;
    else entry.open += row._sum.amount ?? 0;
    committedBySeller.set(row.sellerId, entry);
  }

  const balances = earnedBySeller
    .map((row) => {
      const committed = committedBySeller.get(row.sellerId) ?? { paid: 0, open: 0 };
      const earned = row._sum.sellerAmount ?? 0;
      return {
        sellerId: row.sellerId,
        earned,
        paid: committed.paid,
        open: committed.open,
        due: earned - committed.paid - committed.open,
      };
    })
    .filter((row) => row.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 50);

  const balanceSellers = await prisma.sellerProfile.findMany({
    where: { id: { in: balances.map((row) => row.sellerId) } },
    select: {
      id: true,
      displayName: true,
      payoutMobileOperator: true,
      payoutMobileNumber: true,
      user: { select: { email: true } },
    },
  });
  const sellersById = new Map(balanceSellers.map((seller) => [seller.id, seller]));

  const totalEarned = earnedBySeller.reduce((sum, row) => sum + (row._sum.sellerAmount ?? 0), 0);
  const totalFor = (...list: PayoutStatus[]) =>
    payoutTotals
      .filter((row) => list.includes(row.status))
      .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
  const totalPaid = totalFor("PAID");
  const totalOpen = totalFor("PENDING", "PROCESSING");
  const openCount = payoutTotals
    .filter((row) => row.status === "PENDING" || row.status === "PROCESSING")
    .reduce((sum, row) => sum + row._count._all, 0);
  const totalDue = totalEarned - totalPaid - totalOpen;

  const messageKey = firstParam(searchParams.message);
  const errorKey = firstParam(searchParams.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Versements aux vendeurs</h1>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-600">Revenus des vendeurs (cumul)</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(totalEarned, "XOF")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Déjà versé</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(totalPaid, "XOF")}</p>
        </div>
        <div className="card border-yellow-200 bg-yellow-50">
          <p className="text-sm text-slate-600">
            Demandes à traiter ({openCount})
          </p>
          <p className="mt-1 text-xl font-bold">{formatPrice(totalOpen, "XOF")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Reste dû aux vendeurs</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(Math.max(totalDue, 0), "XOF")}</p>
          <p className="text-xs text-slate-500">Hors demandes en cours</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2 text-sm">
          {FILTERS.map((option) => (
            <Link
              key={option.value}
              href={
                option.value === "OPEN"
                  ? "/admin/versements"
                  : `/admin/versements?statut=${option.value}`
              }
              className={filter === option.value ? "btn-primary" : "btn-secondary"}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <p className="text-sm text-slate-600">
          {total} demande{total > 1 ? "s" : ""}
        </p>

        {payouts.length === 0 ? (
          <div className="card text-sm text-slate-600">Aucune demande.</div>
        ) : (
          <ul className="space-y-4">
            {payouts.map((payout) => {
              const isOpen = payout.status === "PENDING" || payout.status === "PROCESSING";

              return (
                <li key={payout.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold">
                        {formatPrice(payout.amount, payout.currency)}
                      </p>
                      <p className="text-sm font-medium">{payout.seller.displayName}</p>
                      <p className="text-xs text-slate-500">
                        {payout.seller.user.email} · demandé le{" "}
                        {formatDate(payout.requestedAt)}
                      </p>
                      {payout.note && (
                        <p className="mt-1 text-sm text-slate-700">{payout.note}</p>
                      )}
                      {payout.paidAt && (
                        <p className="text-xs text-slate-500">
                          Versé le {formatDate(payout.paidAt)}
                          {payout.reference ? ` · référence ${payout.reference}` : ""}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${PAYOUT_STATUS_STYLES[payout.status]}`}
                    >
                      {PAYOUT_STATUS_LABELS[payout.status]}
                    </span>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      {payout.status === "PENDING" && (
                        <form action={startPayoutAction}>
                          <input type="hidden" name="payoutId" value={payout.id} />
                          <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                            Prendre en charge
                          </button>
                        </form>
                      )}

                      <form
                        action={markPayoutPaidAction}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="payoutId" value={payout.id} />
                        <div>
                          <label htmlFor={`ref-${payout.id}`} className="label">
                            Référence de la transaction (après envoi de l&apos;argent)
                          </label>
                          <input
                            id={`ref-${payout.id}`}
                            name="reference"
                            type="text"
                            required
                            minLength={3}
                            maxLength={100}
                            className="input w-64"
                          />
                        </div>
                        <button type="submit" className="btn-primary px-3 py-2 text-xs">
                          Marquer comme payé
                        </button>
                      </form>

                      <form
                        action={rejectPayoutAction}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="payoutId" value={payout.id} />
                        <div>
                          <label htmlFor={`reason-${payout.id}`} className="label">
                            Motif du refus
                          </label>
                          <input
                            id={`reason-${payout.id}`}
                            name="reason"
                            type="text"
                            required
                            minLength={3}
                            maxLength={200}
                            className="input w-64"
                          />
                        </div>
                        <button
                          type="submit"
                          className="btn-secondary px-3 py-2 text-xs text-red-700"
                        >
                          Refuser
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          basePath="/admin/versements"
          params={{ statut: filter === "OPEN" ? undefined : filter }}
          page={page}
          totalPages={totalPages}
        />
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Soldes par vendeur (reste dû)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gains moins versements effectués ou demandés. Les 50 plus élevés. Les
          gains de moins de 3 jours ne sont pas encore retirables par le vendeur.
        </p>

        {balances.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Aucun solde dû.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4 font-medium">Vendeur</th>
                  <th className="py-2 pr-4 font-medium">Gains</th>
                  <th className="py-2 pr-4 font-medium">Versé</th>
                  <th className="py-2 pr-4 font-medium">Demandé</th>
                  <th className="py-2 pr-4 font-medium">Reste dû</th>
                  <th className="py-2 font-medium">Numéro de versement</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((row) => {
                  const seller = sellersById.get(row.sellerId);

                  return (
                    <tr key={row.sellerId} className="border-b border-slate-100">
                      <td className="py-2 pr-4">
                        <p className="font-medium">{seller?.displayName ?? "-"}</p>
                        <p className="text-xs text-slate-500">{seller?.user.email}</p>
                      </td>
                      <td className="py-2 pr-4">{formatPrice(row.earned, "XOF")}</td>
                      <td className="py-2 pr-4">{formatPrice(row.paid, "XOF")}</td>
                      <td className="py-2 pr-4">{formatPrice(row.open, "XOF")}</td>
                      <td className="py-2 pr-4 font-semibold">
                        {formatPrice(row.due, "XOF")}
                      </td>
                      <td className="py-2 text-xs">
                        {seller?.payoutMobileNumber
                          ? `${operatorLabel(seller.payoutMobileOperator)} ${formatMobileNumber(seller.payoutMobileNumber)}`
                          : "Non renseigné"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
