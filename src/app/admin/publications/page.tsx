// src/app/admin/publications/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { EditionStage, PublicationFeeStatus, PublishingCapacity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  rejectPublicationAction,
  validatePublicationAction,
} from "@/app/admin/publications/actions";
import { formatDate, formatFileSize, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Éditions et forfaits d'édition",
};

export const dynamic = "force-dynamic";

type Tab = PublicationFeeStatus | "MAQUETTE";

const TABS: { value: Tab; label: string }[] = [
  { value: "SUBMITTED", label: "Paiement à vérifier" },
  { value: "MAQUETTE", label: "En maquette" },
  { value: "AWAITING_PAYMENT", label: "En attente du paiement" },
  { value: "REJECTED", label: "Paiement rejeté" },
  { value: "VALIDATED", label: "Forfait validé" },
];

const STATUS_LABELS: Record<PublicationFeeStatus, string> = {
  SUBMITTED: "Paiement à vérifier",
  AWAITING_PAYMENT: "En attente du paiement",
  REJECTED: "Paiement rejeté",
  VALIDATED: "Forfait validé",
};

const STATUS_STYLES: Record<PublicationFeeStatus, string> = {
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  AWAITING_PAYMENT: "bg-slate-100 text-slate-700",
  REJECTED: "bg-red-100 text-red-800",
  VALIDATED: "bg-green-100 text-green-800",
};

const STAGE_LABELS: Record<EditionStage, string> = {
  FEE_PENDING: "Forfait à régler",
  IN_LAYOUT: "En maquette",
  PROOF_PENDING: "Bon à tirer à valider",
  CHANGES_REQUESTED: "Corrections demandées",
  PUBLISHED: "Publié",
  REFUSED: "Refusé",
};

const METHOD_LABELS: Record<string, string> = {
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
};

const CAPACITY_LABELS: Record<PublishingCapacity, string> = {
  AUTHOR: "Auteur",
  INDEPENDENT_PUBLISHER: "Éditeur indépendant (ancien)",
  THIRD_PARTY_SELLER: "Titulaire des droits (ayant droit)",
};

const MESSAGES: Record<string, string> = {
  validee: "Paiement validé : l'ouvrage est publié.",
  "validee-maquette":
    "Paiement validé : l'ouvrage passe en maquette. Il sera publié après le bon à tirer approuvé par l'auteur.",
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

  const rawTab = firstParam(sp.statut);
  const tab: Tab = TABS.find((item) => item.value === rawTab)?.value ?? "SUBMITTED";

  const [groups, layoutProjects] = await Promise.all([
    prisma.publicationFee.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.editionProject.findMany({
      where: { stage: "IN_LAYOUT" },
      select: { productId: true },
    }),
  ]);

  const countByStatus = new Map(groups.map((group) => [group.status, group._count._all]));
  const layoutIds = layoutProjects.map((project) => project.productId);

  const fees = await prisma.publicationFee.findMany({
    where: tab === "MAQUETTE" ? { productId: { in: layoutIds } } : { status: tab },
    orderBy: tab === "SUBMITTED" ? { submittedAt: "asc" } : { createdAt: "desc" },
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
  });

  const projects = await prisma.editionProject.findMany({
    where: { productId: { in: fees.map((fee) => fee.productId) } },
    select: {
      productId: true,
      stage: true,
      contractVersion: true,
      contractAcceptedAt: true,
      signerName: true,
      serviceStartRequested: true,
    },
  });
  const projectByProduct = new Map(projects.map((project) => [project.productId, project]));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  function countFor(value: Tab): number {
    return value === "MAQUETTE" ? layoutIds.length : (countByStatus.get(value) ?? 0);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Éditions et forfaits d&apos;édition</h1>
        <p className="mt-1 text-sm text-slate-600">
          À compte d&apos;auteur, l&apos;auteur règle le forfait d&apos;édition juste après le dépôt, par Mobile Money,
          puis déclare sa référence ici. Vérifiez la réception sur votre application avant de valider : le
          livre passe alors en maquette (il n&apos;est publié qu&apos;après le bon à tirer de l&apos;auteur).
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <div className="flex flex-wrap gap-2 text-sm">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={`/admin/publications?statut=${item.value}`}
            className={tab === item.value ? "btn-primary" : "btn-secondary"}
          >
            {item.label} ({countFor(item.value)})
          </Link>
        ))}
      </div>

      {fees.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune demande dans cette catégorie.</div>
      ) : (
        <ul className="space-y-4">
          {fees.map((fee) => {
            const project = projectByProduct.get(fee.productId);

            return (
              <li key={fee.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{fee.product.title}</p>
                    <p className="text-xs text-slate-500">
                      {fee.product.seller.displayName} · {fee.product.seller.user.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project && (
                      <span className="inline-block rounded-full bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-800">
                        {STAGE_LABELS[project.stage]}
                      </span>
                    )}
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[fee.status]}`}
                    >
                      {STATUS_LABELS[fee.status]}
                    </span>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Forfait à recevoir</dt>
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
                    <dt className="text-xs text-slate-500">Déclaration des droits</dt>
                    <dd>
                      {fee.product.rightsCertifiedAt
                        ? formatDate(fee.product.rightsCertifiedAt)
                        : "non enregistrée"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Fichier PDF déposé</dt>
                    <dd>{formatFileSize(fee.product.pdfSizeBytes)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Dépôt</dt>
                    <dd>{formatDate(fee.createdAt)}</dd>
                  </div>
                </dl>

                {project && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold">Contrat accepté</p>
                    <ul className="mt-1 space-y-0.5 text-slate-700">
                      <li>
                        Version {project.contractVersion}, le {formatDate(project.contractAcceptedAt)}
                      </li>
                      <li>Signature : {project.signerName}</li>
                      <li>
                        Début de prestation demandé avant la fin du délai de rétractation :{" "}
                        {project.serviceStartRequested ? "oui" : "non"}
                      </li>
                    </ul>
                  </div>
                )}

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

                {project && (
                  <p className="mt-3 text-sm">
                    <a
                      href={`/api/admin/edition/${fee.productId}/manuscrit`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Télécharger le manuscrit (PDF déposé par l&apos;auteur)
                    </a>
                  </p>
                )}

                {fee.status === "REJECTED" && fee.rejectionReason && (
                  <p className="mt-3 text-sm text-red-700">Motif du rejet : {fee.rejectionReason}</p>
                )}

                {fee.status === "VALIDATED" && (
                  <p className="mt-3 text-sm text-slate-600">
                    Validé le {fee.validatedAt ? formatDate(fee.validatedAt) : "-"}
                    {fee.validatedBy ? ` par ${fee.validatedBy}` : ""}.{" "}
                    {fee.product.status === "PUBLISHED" ? (
                      <Link
                        href={`/catalogue/${fee.product.slug}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        Voir la page
                      </Link>
                    ) : (
                      "L'ouvrage n'est pas encore publié."
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
                          <strong>{fee.paymentReference ?? "-"}</strong>).
                          {project
                            ? " L'ouvrage passe en maquette ; il sera publié après le bon à tirer de l'auteur."
                            : " L'ouvrage sera publié aussitôt."}
                        </span>
                      </label>
                      <button type="submit" className="btn-primary">
                        {project ? "Valider le forfait" : "Valider et publier"}
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
            );
          })}
        </ul>
      )}

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Ne validez qu&apos;un paiement que vous avez <strong>vu arriver</strong> sur votre compte Mobile
            Money, au bon montant. Comparez la référence et le numéro de l&apos;expéditeur.
          </li>
          <li>
            Une référence de transaction ne peut servir qu&apos;une fois : un auteur ne peut pas la réutiliser
            pour un autre ouvrage.
          </li>
          <li>
            Un ouvrage dont le forfait n&apos;est pas validé, ou dont le bon à tirer n&apos;est pas approuvé,
            n&apos;apparaît ni dans le catalogue ni dans le plan du site.
          </li>
          <li>
            L&apos;onglet « En maquette » liste les livres dont le forfait est validé : téléchargez le
            manuscrit pour la mise en page. Les outils de dépôt de l&apos;épreuve et d&apos;approbation en ligne
            arrivent à l&apos;étape suivante.
          </li>
          <li>Vos propres ouvrages (compte administrateur) sont publiés sans contrat ni forfait.</li>
          <li>Chaque validation et chaque rejet sont inscrits dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
                      }
