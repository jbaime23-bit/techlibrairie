// src/app/admin/commandes/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import { refundOrderAction } from "@/app/admin/commandes/actions";
import { getSellerBalanceXof } from "@/lib/payouts";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Détail d'une commande",
};

export const dynamic = "force-dynamic";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  FAILED: "Échouée",
  CANCELED: "Annulée",
  REFUNDED: "Remboursée",
};

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELED: "bg-slate-100 text-slate-700",
  REFUNDED: "bg-purple-100 text-purple-800",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  SUCCEEDED: "Réussi",
  FAILED: "Échoué",
  CANCELED: "Annulé",
  REFUNDED: "Remboursé",
};

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  STRIPE: "Stripe",
  CINETPAY: "CinetPay",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: "Carte",
  MOBILE_MONEY: "Mobile Money",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
};

const MESSAGES: Record<string, string> = {
  rembourse: "Commande remboursée : liens de téléchargement invalidés.",
};

const ERRORS: Record<string, string> = {
  confirmation: "Cochez la case de confirmation pour rembourser.",
  motif: "Indiquez le motif du remboursement (3 caractères au minimum).",
  etat: "Cette commande n'est plus remboursable (déjà remboursée ou non payée).",
  paiement: "Aucun paiement réussi n'est associé à cette commande.",
  stripe:
    "Stripe a refusé le remboursement. Consultez le tableau de bord Stripe et les journaux Vercel.",
  reference:
    "Référence invalide : saisissez la référence du remboursement Mobile Money (3 à 100 caractères : lettres, chiffres, espaces, tirets).",
};

interface RefundInfo {
  at?: string;
  method?: string;
  reason?: string;
  reference?: string | null;
}

function readRefundInfo(payload: unknown): RefundInfo | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  const refund = (payload as Record<string, unknown>).refund;
  if (typeof refund !== "object" || refund === null || Array.isArray(refund)) {
    return null;
  }
  const record = refund as Record<string, unknown>;
  return {
    at: typeof record.at === "string" ? record.at : undefined,
    method: typeof record.method === "string" ? record.method : undefined,
    reason: typeof record.reason === "string" ? record.reason : undefined,
    reference: typeof record.reference === "string" ? record.reference : null,
  };
}

const REFUND_METHOD_LABELS: Record<string, string> = {
  "stripe-api": "Remboursement automatique Stripe",
  "stripe-dashboard": "Remboursement fait depuis le tableau de bord Stripe",
  "stripe-deja-rembourse": "Déjà remboursé dans Stripe",
  "manuel-mobile-money": "Remboursement manuel par Mobile Money",
};

export default async function AdminCommandeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (!/^[a-z0-9]{1,40}$/i.test(params.id)) {
    notFound();
  }

  await requireAdmin(`/admin/commandes/${params.id}`);

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { name: true, email: true } },
      items: {
        include: { seller: { select: { id: true, displayName: true } } },
      },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    notFound();
  }

  const settledPayment = order.payments.find(
    (payment) => payment.status === "SUCCEEDED" || payment.status === "REFUNDED"
  );
  const refundInfo = settledPayment ? readRefundInfo(settledPayment.providerPayload) : null;

  // Risque : vendeur déjà payé au-delà de ses gains restants après remboursement.
  const warnings: { name: string; exposure: number }[] = [];

  if (order.status === "PAID") {
    const amountBySeller = new Map<string, { name: string; amount: number }>();
    for (const item of order.items) {
      if (item.currency !== "XOF") continue;
      const entry = amountBySeller.get(item.seller.id) ?? {
        name: item.seller.displayName,
        amount: 0,
      };
      entry.amount += item.sellerAmount;
      amountBySeller.set(item.seller.id, entry);
    }

    for (const [sellerId, info] of Array.from(amountBySeller.entries())) {
      const balance = await getSellerBalanceXof(sellerId);
      const exposure = balance.paid + balance.open - (balance.earned - info.amount);
      if (exposure > 0) {
        warnings.push({ name: info.name, exposure });
      }
    }
  }

  const messageKey = firstParam(searchParams.message);
  const errorKey = firstParam(searchParams.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  const canRefund = order.status === "PAID" && Boolean(settledPayment);
  const isStripe = settledPayment?.provider === "STRIPE";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/commandes"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          Retour aux commandes
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Commande {order.number}</h1>
            <p className="text-sm text-slate-600">
              {order.buyer.name ?? "Sans nom"} · {order.buyerEmail}
            </p>
            <p className="text-xs text-slate-500">
              Créée le {formatDate(order.createdAt)}
              {order.paidAt ? ` · payée le ${formatDate(order.paidAt)}` : ""}
            </p>
          </div>
          <span
            className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <h2 className="text-lg font-semibold">Ouvrages</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 pr-4 font-medium">Ouvrage</th>
                <th className="py-2 pr-4 font-medium">Vendeur</th>
                <th className="py-2 pr-4 font-medium">Prix</th>
                <th className="py-2 pr-4 font-medium">Commission</th>
                <th className="py-2 font-medium">Part vendeur</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{item.productTitle}</td>
                  <td className="py-2 pr-4">{item.seller.displayName}</td>
                  <td className="py-2 pr-4">{formatPrice(item.unitAmount, item.currency)}</td>
                  <td className="py-2 pr-4">
                    {formatPrice(item.commissionAmount, item.currency)} (
                    {item.commissionRateBps / 100} %)
                  </td>
                  <td className="py-2">{formatPrice(item.sellerAmount, item.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-right text-sm font-semibold">
          Total : {formatPrice(order.totalAmount, order.currency)}
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Paiements</h2>

        {order.payments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Aucun paiement enregistré.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {order.payments.map((payment) => (
              <li key={payment.id} className="py-3">
                <p className="font-medium">
                  {PROVIDER_LABELS[payment.provider]} · {METHOD_LABELS[payment.method]} ·{" "}
                  {PAYMENT_STATUS_LABELS[payment.status]}
                </p>
                <p className="text-xs text-slate-500">
                  Montant débité : {formatPrice(payment.amount, payment.currency)}
                  {payment.baseAmountXof !== null && payment.exchangeRate
                    ? ` (converti depuis ${formatPrice(payment.baseAmountXof, "XOF")} au taux de ${payment.exchangeRate.toNumber().toLocaleString("fr-FR", { maximumFractionDigits: 6 })} FCFA)`
                    : ""}
                </p>
                <p className="text-xs text-slate-400">
                  Référence : {payment.providerReference} · {formatDate(payment.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {order.status === "REFUNDED" && (
        <section className="card border-purple-200 bg-purple-50 text-sm">
          <h2 className="text-lg font-semibold text-purple-900">Commande remboursée</h2>
          {refundInfo ? (
            <ul className="mt-2 space-y-1 text-purple-900">
              {refundInfo.at && <li>Date : {formatDate(refundInfo.at)}</li>}
              {refundInfo.method && (
                <li>
                  Mode : {REFUND_METHOD_LABELS[refundInfo.method] ?? refundInfo.method}
                </li>
              )}
              {refundInfo.reason && <li>Motif : {refundInfo.reason}</li>}
              {refundInfo.reference && <li>Référence : {refundInfo.reference}</li>}
            </ul>
          ) : (
            <p className="mt-2 text-purple-900">Aucun détail de remboursement enregistré.</p>
          )}
        </section>
      )}

      {canRefund && settledPayment && (
        <section className="card border-red-200">
          <h2 className="text-lg font-semibold">Rembourser cette commande</h2>

          {warnings.length > 0 && (
            <div className="alert-error mt-3">
              <p className="font-semibold">Attention : vendeur déjà payé</p>
              <ul className="mt-1 list-disc pl-5">
                {warnings.map((warning) => (
                  <li key={warning.name}>
                    {warning.name} a reçu ou demandé {formatPrice(warning.exposure, "XOF")} de
                    plus que ses gains restants après ce remboursement. La
                    boutique supportera cette somme, ou vous pourrez la lui
                    réclamer.
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form action={refundOrderAction} className="mt-4 space-y-4">
            <input type="hidden" name="orderId" value={order.id} />

            {isStripe ? (
              <p className="text-sm text-slate-700">
                Le montant débité ({formatPrice(settledPayment.amount, settledPayment.currency)}) sera
                remboursé <strong>intégralement et automatiquement</strong> sur la carte de
                l&apos;acheteur par Stripe.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Le paiement a été fait par Mobile Money. Le remboursement est{" "}
                  <strong>manuel</strong> : envoyez d&apos;abord{" "}
                  {formatPrice(settledPayment.amount, settledPayment.currency)} à
                  l&apos;acheteur depuis votre application Orange Money ou Moov
                  Money, puis saisissez la référence de cette transaction.
                </p>
                <div>
                  <label htmlFor="reference" className="label">
                    Référence du remboursement
                  </label>
                  <input
                    id="reference"
                    name="reference"
                    type="text"
                    required
                    minLength={3}
                    maxLength={100}
                    className="input max-w-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="reason" className="label">
                Motif du remboursement
              </label>
              <input
                id="reason"
                name="reason"
                type="text"
                required
                minLength={3}
                maxLength={200}
                className="input"
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
              <span>
                Je confirme le remboursement intégral de cette commande. Les liens
                de téléchargement seront immédiatement invalidés et cette action
                est définitive.
              </span>
            </label>

            <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700">
              Rembourser la commande
            </button>
          </form>
        </section>
      )}
    </div>
  );
      }
