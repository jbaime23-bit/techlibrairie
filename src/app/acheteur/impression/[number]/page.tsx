// src/app/acheteur/impression/[number]/page.tsx
// Suivi d'une commande d'exemplaires imprimés : récapitulatif, paiement, statut et suivi du colis.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { declarePrintPaymentAction } from "@/app/acheteur/impression/actions";
import { getContributionConfig } from "@/lib/publication-fee";
import {
  BUYER_STATUS_LABELS,
  PRINT_COUNTRIES,
  PRINT_ORDER_STATUS_STYLES,
  ROUTE_LABELS,
} from "@/lib/print-shipping";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ma commande imprimée",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  declare: "Votre paiement a été déclaré. Il est en cours de vérification.",
};

const ERRORS: Record<string, string> = {
  methode: "Choisissez le moyen utilisé.",
  expediteur: "Indiquez le numéro (ou le nom) depuis lequel vous avez envoyé l'argent.",
  reference:
    "Référence de transaction invalide : 4 à 40 caractères (lettres, chiffres, point ou tiret), telle qu'indiquée dans le message de confirmation.",
  doublon: "Cette référence de transaction a déjà été déclarée pour une autre commande.",
  etat: "Cette commande n'est plus à régler.",
  ferme: "Le règlement par Mobile Money n'est pas encore ouvert. Choisissez « Autre moyen » ou contactez-nous.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

export default async function PrintOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { number } = await params;
  const sp = await searchParams;

  if (!/^LI-[A-Z0-9]{8}$/.test(number)) {
    notFound();
  }

  const user = await requireUser(`/acheteur/impression/${number}`);

  const order = await prisma.printOrder.findFirst({
    where: { number, buyerId: user.id },
  });

  if (!order) {
    notFound();
  }

  const config = getContributionConfig();
  const countryName =
    PRINT_COUNTRIES.find((country) => country.code === order.shipCountry)?.name ?? order.shipCountry;
  const tracking = (order.trackingUrls ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//.test(line));

  const toPay = order.status === "AWAITING_PAYMENT";
  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href="/acheteur/impression" className="text-sm font-semibold text-brand-700 hover:underline">
            Mes livres imprimés
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Commande {order.number}</h1>
          <span
            className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${PRINT_ORDER_STATUS_STYLES[order.status]}`}
          >
            {BUYER_STATUS_LABELS[order.status]}
          </span>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        )}
        {error && <div className="alert-error">{error}</div>}

        <section className="card text-sm">
          <h2 className="text-lg font-semibold">Récapitulatif</h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">
                {order.quantity} × {order.productTitle}
              </dt>
              <dd>{formatPrice(order.unitPriceXof * order.quantity, "XOF")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Livraison</dt>
              <dd>{formatPrice(order.shippingXof, "XOF")}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(order.totalXof, "XOF")}</dd>
            </div>
          </dl>
          {order.isAuthorCopy && (
            <p className="mt-2 text-xs text-slate-500">
              Exemplaires d&apos;auteur : commandés au prix de fabrication, sans gain.
            </p>
          )}
        </section>

        <section className="card text-sm text-slate-700">
          <h2 className="text-lg font-semibold">Livraison</h2>
          <p className="mt-2">
            {order.shipName}
            <br />
            {order.shipStreet1}
            {order.shipStreet2 ? <><br />{order.shipStreet2}</> : null}
            <br />
            {order.shipPostcode} {order.shipCity}
            {order.shipState ? `, ${order.shipState}` : ""}
            <br />
            {countryName}
            <br />
            Tél. {order.shipPhone}
          </p>
          <p className="mt-2 text-xs text-slate-500">{ROUTE_LABELS[order.route] ?? order.route}</p>
        </section>

        {order.status === "PAYMENT_SUBMITTED" && (
          <section className="card border-yellow-200 bg-yellow-50 text-sm text-yellow-900">
            <h2 className="text-lg font-semibold">Paiement en cours de vérification</h2>
            <p className="mt-1">
              Vous avez déclaré votre paiement
              {order.paymentSubmittedAt ? ` le ${formatDate(order.paymentSubmittedAt)}` : ""} (référence{" "}
              <strong>{order.paymentReference ?? "-"}</strong>). La fabrication commence dès sa validation.
            </p>
          </section>
        )}

        {(order.status === "PAID" ||
          order.status === "SENDING" ||
          order.status === "ERROR" ||
          order.status === "SENT_TO_LULU" ||
          order.status === "LOCAL_PENDING") && (
          <section className="card border-green-200 bg-green-50 text-sm text-green-900">
            <h2 className="text-lg font-semibold">Paiement reçu</h2>
            <p className="mt-1">
              {order.route === "LOCAL_MANUAL"
                ? "Votre commande est livrée au Burkina Faso : elle est traitée localement. Nous vous contactons pour la fabrication et la livraison."
                : "Votre exemplaire est fabriqué à la commande, puis expédié. Vous recevrez un message dès son expédition."}
            </p>
          </section>
        )}

        {(order.status === "SHIPPED" || order.status === "DELIVERED") && (
          <section className="card border-green-200 bg-green-50 text-sm text-green-900">
            <h2 className="text-lg font-semibold">
              {order.status === "DELIVERED" ? "Commande livrée" : "Commande expédiée"}
            </h2>
            {order.fulfilmentNote && <p className="mt-1">{order.fulfilmentNote}</p>}
            {tracking.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {tracking.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      Suivre le colis
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {order.status === "CANCELED" && (
          <div className="alert-error">
            Cette commande est annulée.{order.canceledReason ? ` Motif : ${order.canceledReason}` : ""}
          </div>
        )}

        {toPay && (
          <>
            {order.paymentRejectionReason && (
              <div className="alert-error">
                <p className="font-semibold">Votre paiement n&apos;a pas pu être validé.</p>
                <p className="mt-1">Motif : {order.paymentRejectionReason}</p>
              </div>
            )}

            <section className="card">
              <h2 className="text-lg font-semibold">1. Réglez {formatPrice(order.totalXof, "XOF")}</h2>

              {config.paymentOpen ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {config.orangeNumber && (
                    <li className="rounded-lg border border-slate-200 p-3">
                      <span className="block text-xs text-slate-500">Orange Money</span>
                      <span className="text-lg font-bold">{config.orangeNumber}</span>
                    </li>
                  )}
                  {config.moovNumber && (
                    <li className="rounded-lg border border-slate-200 p-3">
                      <span className="block text-xs text-slate-500">Moov Money</span>
                      <span className="text-lg font-bold">{config.moovNumber}</span>
                    </li>
                  )}
                  <li className="text-slate-600">
                    Indiquez dans le message du transfert la référence <strong>{order.number}</strong>.
                  </li>
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Le règlement par Mobile Money n&apos;est pas encore ouvert.
                </p>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Vous résidez à l&apos;étranger ou vous avez un autre moyen de paiement ? Contactez-nous par le
                formulaire en bas de page, puis déclarez votre paiement ci-dessous avec « Autre moyen ».
              </p>
            </section>

            <section className="card">
              <h2 className="text-lg font-semibold">2. Déclarez votre paiement</h2>

              <form action={declarePrintPaymentAction} className="mt-4 space-y-4">
                <input type="hidden" name="number" value={order.number} />

                <div>
                  <label htmlFor="method" className="label">
                    Moyen utilisé
                  </label>
                  <select id="method" name="method" required defaultValue="" className="input">
                    <option value="" disabled>
                      Choisir...
                    </option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="MOOV_MONEY">Moov Money</option>
                    <option value="AUTRE">Autre moyen</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="payer" className="label">
                    Numéro (ou nom) depuis lequel vous avez payé
                  </label>
                  <input id="payer" name="payer" type="text" required maxLength={60} className="input" />
                </div>

                <div>
                  <label htmlFor="reference" className="label">
                    Référence de la transaction
                  </label>
                  <input
                    id="reference"
                    name="reference"
                    type="text"
                    required
                    autoComplete="off"
                    maxLength={60}
                    className="input"
                  />
                </div>

                <button type="submit" className="btn-primary">
                  Déclarer mon paiement
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
  }
