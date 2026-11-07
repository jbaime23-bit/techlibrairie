// src/app/admin/publications/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { PublicationFeeStatus, PublishingCapacity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  rejectPublicationAction,
  validatePublicationAction,
} from "@/app/admin/publications/actions";
import { formatDate, formatFileSize, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Publications et frais de publication",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<PublicationFeeStatus, string> = {
  SUBMITTED: "Paiement à vérifier",
  AWAITING_PAYMENT: "En attente du paiement",
  REJECTED: "Paiement rejeté",
  VALIDATED: "Validée",
};

const STATUS_STYLES: Record<PublicationFeeStatus, string> = {
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  AWAITING_PAYMENT: "bg-slate-100 text-slate-700",
  REJECTED: "bg-red-100 text-red-800",
  VALIDATED: "bg-green-100 text-green-800",
};

const STATUSES: PublicationFeeStatus[] = [
  "SUBMITTED",
  "AWAITING_PAYMENT",
  "REJECTED",
  "VALIDATED",
];

const METHOD_LABELS: Record<string, string> = {
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
};

const CAPACITY_LABELS: Record<PublishingCapacity, string> = {
  AUTHOR: "Auteur",
  INDEPENDENT_PUBLISHER: "Éditeur indépendant",
  THIRD_PARTY_SELLER: "Vendeur tiers",
};

const MESSAGES: Record<string, string> = {
  validee: "Paiement validé : l'ouvrage est publié.",
  rejetee: "Paiement rejeté : l'auteur peut le déclarer à nouveau.",
};

const ERRORS: Record<string, string> = {
  confirmation: "Cochez la case de confirmation pour valider.",
  motif: "Indiquez le motif du rejet (3 caractères au minimum).",
  etat: "Cette demande a déjà été traitée ou n'est plus à vérifier.",
};

export default async function AdminPublicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/publications");

  const rawStatus = firstParam(sp.statut);
  const status = STATUSES.find((value) => value === rawStatus) ?? "SUBMITTED";

  const [groups, fees] = await Promise.all([
    prisma.publicationFee.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.publicationFee.findMany({
      where: { status },
      orderBy: status === "SUBMITTED" ? { submittedAt: "asc" } : { createdAt: "desc" },
      take: 50,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            authorName: true,
            isbn: true,
            publishingCapacity: true,
            rightsCertifiedAt: true,
            pdfSizeBytes: true,
            seller: {
              select: { displayName: true, user: { select: { email: true } } },
            },
          },
        },
      },
    }),
  ]);

  const countByStatus = new Map(groups.map((group) => [group.status, group._count._all]));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Publications et frais de publication</h1>
        <p className="mt-1 text-sm text-slate-600">
          Un ouvrage déposé par un auteur n&apos;est publié qu&apos;après le règlement des frais de
          publication. L&apos;auteur envoie la somme par Mobile Money puis déclare sa référence ici : vous
          vérifiez la réception sur votre application avant de valider.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <div className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`/admin/publications?statut=${value}`}
            className={status === value ? "btn-primary" : "btn-secondary"}
          >
            {STATUS_LABELS[value]} ({countByStatus.get(value) ?? 0})
          </Link>
        ))}
      </div>

      {fees.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune demande dans cette catégorie.</div>
      ) : (
        <ul className="space-y-4">
          {fees.map((fee) => (
            <li key={fee.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{fee.product.title}</p>
                  <p className="text-xs text-slate-500">
                    {fee.product.seller.displayName} · {fee.product.seller.user.email}
                  </p>
                </div>
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[fee.status]}`}
                >
                  {STATUS_LABELS[fee.status]}
                </span>
              </div>

              <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Frais à recevoir</dt>
                  <dd className="font-semibold">{formatPrice(fee.amountXof, "XOF")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Qualité et auteur</dt>
                  <dd>
                    {fee.product.publishingCapacity
                      ? CAPACITY_LABELS[fee.product.publishingCapacity]
                      : "Non indiquée"}
                    {fee.product.authorName ? ` · ${fee.product.authorName}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">ISBN</dt>
                  <dd>{fee.product.isbn ?? "non renseigné"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Droits certifiés</dt>
                  <dd>
                    {fee.product.rightsCertifiedAt
                      ? formatDate(fee.product.rightsCertifiedAt)
                      : "non certifiés"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Fichier PDF</dt>
                  <dd>{formatFileSize(fee.product.pdfSizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Dépôt</dt>
                  <dd>{formatDate(fee.createdAt)}</dd>
                </div>
              </dl>

              {fee.method && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">Paiement déclaré</p>
                  <ul className="mt-1 space-y-0.5 text-slate-700">
                    <li>Moyen : {METHOD_LABELS[fee.method] ?? fee.method}</li>
                    <li>Numéro de l&apos;expéditeur : {fee.payerPhone ?? "-"}</li>
                    <li>Référence de la transaction : {fee.paymentReference ?? "-"}</li>
                    {fee.submittedAt && <li>Déclaré le {formatDate(fee.submittedAt)}</li>}
                  </ul>
                </div>
              )}

              {fee.status === "REJECTED" && fee.rejectionReason && (
                <p className="mt-3 text-sm text-red-700">Motif du rejet : {fee.rejectionReason}</p>
              )}

              {fee.status === "VALIDATED" && (
                <p className="mt-3 text-sm text-slate-600">
                  Validée le {fee.validatedAt ? formatDate(fee.validatedAt) : "-"}
                  {fee.validatedBy ? ` par ${fee.validatedBy}` : ""}.{" "}
                  {fee.product.status === "PUBLISHED" && (
                    <Link
                      href={`/catalogue/${fee.product.slug}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Voir la page
                    </Link>
                  )}
                </p>
              )}

              {fee.status === "SUBMITTED" && (
                <div className="mt-4 space-y-4">
                  <form action={validatePublicationAction} className="space-y-3">
                    <input type="hidden" name="feeId" value={fee.id} />
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                      <span>
                        J&apos;ai vérifié sur mon application Mobile Money que{" "}
                        <strong>{formatPrice(fee.amountXof, "XOF")}</strong> ont bien été reçus (référence{" "}
                        <strong>{fee.paymentReference ?? "-"}</strong>). L&apos;ouvrage sera publié aussitôt.
                      </span>
                    </label>
                    <button type="submit" className="btn-primary">
                      Valider et publier
                    </button>
                  </form>

                  <form action={rejectPublicationAction} className="space-y-2">
                    <input type="hidden" name="feeId" value={fee.id} />
                    <label htmlFor={`reason-${fee.id}`} className="label">
                      Ou rejeter ce paiement (motif transmis à l&apos;auteur)
                    </label>
                    <input
                      id={`reason-${fee.id}`}
                      name="reason"
                      type="text"
                      required
                      minLength={3}
                      maxLength={200}
                      className="input"
                    />
                    <button type="submit" className="btn-secondary text-red-700">
                      Rejeter le paiement
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Ne validez qu&apos;un paiement que vous avez <strong>vu arriver</strong> sur votre compte
            Mobile Money, au bon montant. Comparez la référence et le numéro de l&apos;expéditeur.
          </li>
          <li>
            Une référence de transaction ne peut servir qu&apos;une fois : un auteur ne peut pas la réutiliser
            pour un autre ouvrage.
          </li>
          <li>
            Un ouvrage tant que ses frais ne sont pas validés n&apos;apparaît ni dans le catalogue, ni dans le plan
            du site.
          </li>
          <li>
            Vos propres ouvrages (compte administrateur) sont publiés sans frais.
          </li>
          <li>Chaque validation et chaque rejet sont inscrits dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
  }
