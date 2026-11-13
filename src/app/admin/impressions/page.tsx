// src/app/admin/impressions/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, PrintOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  cancelPrintOrderAction,
  markLocalShippedAction,
  markPrintDeliveredAction,
  rejectPrintPaymentAction,
  retryPrintDispatchAction,
  syncLuluStatusAction,
  validatePrintPaymentAction,
} from "@/app/admin/impressions/actions";
import { getLuluConfig, isLuluAutoEnabled } from "@/lib/lulu";
import {
  PRINT_COUNTRIES,
  PRINT_ORDER_STATUS_LABELS,
  PRINT_ORDER_STATUS_STYLES,
  ROUTE_LABELS,
} from "@/lib/print-shipping";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Commandes imprimées",
};

export const dynamic = "force-dynamic";

type TabKey = "paiement" | "local" | "envoi" | "lulu" | "expediees" | "attente" | "annulees";

const TABS: { value: TabKey; label: string; statuses: PrintOrderStatus[] }[] = [
  { value: "paiement", label: "Paiement à vérifier", statuses: ["PAYMENT_SUBMITTED"] },
  { value: "local", label: "À traiter localement", statuses: ["LOCAL_PENDING"] },
  { value: "envoi", label: "À envoyer ou en erreur", statuses: ["PAID", "ERROR", "SENDING"] },
  { value: "lulu", label: "Chez Lulu", statuses: ["SENT_TO_LULU"] },
  { value: "expediees", label: "Expédiées et livrées", statuses: ["SHIPPED", "DELIVERED"] },
  { value: "attente", label: "En attente du paiement", statuses: ["AWAITING_PAYMENT"] },
  { value: "annulees", label: "Annulées", statuses: ["CANCELED"] },
];

const PAID_STATUSES: PrintOrderStatus[] = [
  "PAID",
  "SENDING",
  "SENT_TO_LULU",
  "LOCAL_PENDING",
  "SHIPPED",
  "DELIVERED",
  "ERROR",
];

const METHOD_LABELS: Record<string, string> = {
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  AUTRE: "Autre moyen",
};

const MESSAGES: Record<string, string> = {
  validee: "Paiement validé : la commande est envoyée (ou à traiter localement pour le Burkina Faso).",
  "validee-attention":
    "Paiement validé, mais l'envoi n'a pas abouti ou est désactivé : voir l'onglet « À envoyer ou en erreur ».",
  rejetee: "Paiement rejeté : l'acheteur peut le déclarer à nouveau.",
  envoyee: "Commande envoyée.",
  "envoi-echec": "L'envoi n'a pas abouti : le message d'erreur est indiqué sur la commande.",
  actualisee: "Statut actualisé.",
  expediee: "Commande marquée expédiée : l'acheteur est prévenu.",
  livree: "Commande marquée livrée.",
  annulee: "Commande annulée.",
  "annulee-remboursement":
    "Commande annulée. Elle était payée : remboursez l'acheteur hors du site et conservez la preuve.",
};

const ERRORS: Record<string, string> = {
  confirmation: "Cochez la case de confirmation pour valider.",
  "confirmation-envoi":
    "Cochez la case pour confirmer que vous avez vérifié chez Lulu qu'aucune commande d'impression n'existe déjà.",
  motif: "Indiquez un motif (3 caractères au minimum).",
  etat: "Cette commande n'est plus dans cet état.",
  lulu: "Lulu n'a pas répondu : voir le message d'erreur sur la commande.",
};

export default async function AdminImpressionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/impressions");

  const rawTab = firstParam(sp.statut);
  const tab = TABS.find((item) => item.value === rawTab) ?? TABS[0];

  const where: Prisma.PrintOrderWhereInput = { status: { in: tab.statuses } };

  const [groups, orders, owed] = await Promise.all([
    prisma.printOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.printOrder.findMany({
      where,
      orderBy: tab.value === "paiement" ? { paymentSubmittedAt: "asc" } : { createdAt: "desc" },
      take: 50,
    }),
    prisma.printOrder.aggregate({
      where: { status: { in: PAID_STATUSES } },
      _sum: { authorNetXof: true },
    }),
  ]);

  const countByStatus = new Map(groups.map((group) => [group.status, group._count._all]));
  const countFor = (statuses: PrintOrderStatus[]): number =>
    statuses.reduce((total, status) => total + (countByStatus.get(status) ?? 0), 0);

  const luluKeys = getLuluConfig() !== null;
  const luluAuto = isLuluAutoEnabled();

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Commandes imprimées</h1>
        <p className="mt-1 text-sm text-slate-600">
          Commandes d&apos;exemplaires imprimés à la demande. Après validation du paiement, une commande livrée à
          l&apos;étranger part automatiquement chez Lulu ; une commande livrée au Burkina Faso est bloquée pour un
          traitement local.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card text-sm">
        <ul className="space-y-1 text-slate-700">
          <li>
            Clés Lulu : <strong>{luluKeys ? "présentes" : "absentes"}</strong> · Envoi automatique :{" "}
            <strong>{luluAuto ? "activé" : "désactivé"}</strong>
          </li>
          <li>
            Sommes dues aux auteurs sur les exemplaires imprimés payés :{" "}
            <strong>{formatPrice(owed._sum.authorNetXof ?? 0, "XOF")}</strong>{" "}
            <span className="text-xs text-slate-500">
              (pas encore intégrées à leur solde de versements)
            </span>
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={`/admin/impressions?statut=${item.value}`}
            className={tab.value === item.value ? "btn-primary" : "btn-secondary"}
          >
            {item.label} ({countFor(item.statuses)})
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune commande dans cette catégorie.</div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const countryName =
              PRINT_COUNTRIES.find((country) => country.code === order.shipCountry)?.name ??
              order.shipCountry;
            const tracking = (order.trackingUrls ?? "")
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => /^https?:\/\//.test(line));
            const cancelable = ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "PAID", "ERROR", "LOCAL_PENDING"].includes(
              order.status
            );

            return (
              <li key={order.id} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {order.number} · {order.productTitle}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.buyerEmail} · {formatDate(order.createdAt)}
                      {order.isAuthorCopy ? " · exemplaires d'auteur" : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${PRINT_ORDER_STATUS_STYLES[order.status]}`}
                  >
                    {PRINT_ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>

                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Quantité</dt>
                    <dd>{order.quantity}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Total payé par l&apos;acheteur</dt>
                    <dd className="font-semibold">{formatPrice(order.totalXof, "XOF")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Coût de fabrication (par exemplaire)</dt>
                    <dd>{formatPrice(order.printCostXof, "XOF")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Gain de l&apos;auteur</dt>
                    <dd>{formatPrice(order.authorNetXof, "XOF")}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Livraison ({ROUTE_LABELS[order.route] ?? order.route})</dt>
                    <dd>
                      {order.shipName}, {order.shipStreet1}
                      {order.shipStreet2 ? `, ${order.shipStreet2}` : ""}, {order.shipPostcode} {order.shipCity}
                      {order.shipState ? `, ${order.shipState}` : ""}, {countryName} · Tél. {order.shipPhone}
                    </dd>
                  </div>
                </dl>

                {order.paymentMethod && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold">Paiement déclaré</p>
                    <ul className="mt-1 space-y-0.5 text-slate-700">
                      <li>Moyen : {METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</li>
                      <li>Expéditeur : {order.payerPhone ?? "-"}</li>
                      <li>Référence : {order.paymentReference ?? "-"}</li>
                      {order.paymentSubmittedAt && <li>Déclaré le {formatDate(order.paymentSubmittedAt)}</li>}
                    </ul>
                  </div>
                )}

                {order.status === "ERROR" || (order.status === "PAID" && order.lastDispatchError) ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-semibold">Message d&apos;erreur de l&apos;envoi</p>
                    <p className="mt-1 break-words">{order.lastDispatchError ?? "Aucun détail."}</p>
                  </div>
                ) : null}

                {order.luluPrintJobId !== null && (
                  <p className="text-sm text-slate-700">
                    Commande d&apos;impression Lulu n° <strong>{order.luluPrintJobId}</strong>
                    {order.luluStatus ? ` · statut : ${order.luluStatus}` : ""}
                  </p>
                )}

                {order.fulfilmentNote && (
                  <p className="text-sm text-slate-600">Note : {order.fulfilmentNote}</p>
                )}

                {tracking.length > 0 && (
                  <ul className="list-disc pl-5 text-sm">
                    {tracking.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
                          Suivi du colis
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {order.status === "PAYMENT_SUBMITTED" && (
                  <div className="space-y-4">
                    <form action={validatePrintPaymentAction} className="space-y-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                        <span>
                          J&apos;ai vérifié que <strong>{formatPrice(order.totalXof, "XOF")}</strong> ont bien été
                          reçus (référence <strong>{order.paymentReference ?? "-"}</strong>).{" "}
                          {order.route === "LOCAL_MANUAL"
                            ? "La commande sera à traiter localement (Burkina Faso)."
                            : luluAuto
                              ? "La commande partira aussitôt chez Lulu."
                              : "L'envoi automatique est désactivé : la commande restera à envoyer."}
                        </span>
                      </label>
                      <button type="submit" className="btn-primary">
                        Valider le paiement
                      </button>
                    </form>

                    <form action={rejectPrintPaymentAction} className="space-y-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <label htmlFor={`reject-${order.id}`} className="label">
                        Ou rejeter ce paiement (motif transmis à l&apos;acheteur)
                      </label>
                      <input id={`reject-${order.id}`} name="reason" type="text" required minLength={3} maxLength={200} className="input" />
                      <button type="submit" className="btn-secondary text-red-700">
                        Rejeter le paiement
                      </button>
                    </form>
                  </div>
                )}

                {(order.status === "PAID" || order.status === "ERROR") && (
                  <form action={retryPrintDispatchAction} className="space-y-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    {order.status === "ERROR" && (
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                        <span>
                          J&apos;ai vérifié chez Lulu qu&apos;aucune commande d&apos;impression n&apos;existe déjà pour{" "}
                          {order.number} (sinon l&apos;exemplaire serait imprimé deux fois).
                        </span>
                      </label>
                    )}
                    <button type="submit" className="btn-primary">
                      {order.status === "ERROR" ? "Relancer l'envoi" : "Envoyer maintenant"}
                    </button>
                  </form>
                )}

                {order.status === "SENT_TO_LULU" && (
                  <form action={syncLuluStatusAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button type="submit" className="btn-secondary">
                      Actualiser le statut chez Lulu
                    </button>
                  </form>
                )}

                {order.status === "LOCAL_PENDING" && (
                  <form action={markLocalShippedAction} className="space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <label htmlFor={`note-${order.id}`} className="label">
                      Marquer comme expédiée (note transmise à l&apos;acheteur : transporteur, suivi...)
                    </label>
                    <input id={`note-${order.id}`} name="note" type="text" maxLength={300} className="input" />
                    <button type="submit" className="btn-primary">
                      Marquer expédiée
                    </button>
                  </form>
                )}

                {(order.status === "SHIPPED" || order.status === "SENT_TO_LULU" || order.status === "LOCAL_PENDING") && (
                  <form action={markPrintDeliveredAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button type="submit" className="btn-secondary">
                      Marquer livrée
                    </button>
                  </form>
                )}

                {cancelable && (
                  <form action={cancelPrintOrderAction} className="space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <label htmlFor={`cancel-${order.id}`} className="label">
                      Annuler cette commande (motif)
                      {order.paidAt ? " : elle est payée, remboursez l'acheteur hors du site" : ""}
                    </label>
                    <input id={`cancel-${order.id}`} name="reason" type="text" required minLength={3} maxLength={200} className="input" />
                    <button type="submit" className="btn-secondary text-red-700">
                      Annuler la commande
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Burkina Faso</strong> : l&apos;envoi automatique vers Lulu est toujours bloqué. La commande
            passe « À traiter localement » après validation du paiement.
          </li>
          <li>
            <strong>Étranger</strong> : le paiement validé déclenche la requête vers Lulu avec le code
            d&apos;impression, les deux PDF (liens signés valables 24 heures) et l&apos;adresse du client.
          </li>
          <li>
            Une commande d&apos;impression chez Lulu doit être <strong>réglée sur votre compte Lulu</strong> (moyen
            de paiement enregistré chez eux), sinon elle reste en attente de paiement de leur côté.
          </li>
          <li>
            Ne relancez un envoi en erreur qu&apos;après avoir vérifié chez Lulu qu&apos;aucune commande
            d&apos;impression n&apos;a été créée pour ce numéro.
          </li>
          <li>Chaque validation, rejet, relance, expédition et annulation est inscrit dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
  }
