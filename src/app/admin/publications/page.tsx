// src/app/admin/publications/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type {
  EditionStage,
  Prisma,
  PublicationFeeStatus,
  PublishingCapacity,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  rejectPublicationAction,
  validatePublicationAction,
} from "@/app/admin/publications/actions";
import { refuseEditionAction } from "@/app/admin/edition/actions";
import { EditionProofForm } from "@/components/admin/edition-proof-form";
import { EDITION_STAGE_LABELS, EDITION_STAGE_STYLES } from "@/lib/edition-labels";
import { formatDate, formatFileSize, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Éditions à compte d'auteur",
};

export const dynamic = "force-dynamic";

type TabKey = "paiement" | "maquette" | "bat" | "attente" | "publiees" | "refusees";

const TABS: { value: TabKey; label: string }[] = [
  { value: "paiement", label: "Paiement à vérifier" },
  { value: "maquette", label: "En maquette" },
  { value: "bat", label: "Bon à tirer" },
  { value: "attente", label: "En attente du paiement" },
  { value: "publiees", label: "Publiées" },
  { value: "refusees", label: "Refusées" },
];

const FEE_STATUS_LABELS: Record<PublicationFeeStatus, string> = {
  SUBMITTED: "Paiement à vérifier",
  AWAITING_PAYMENT: "En attente du paiement",
  REJECTED: "Paiement rejeté",
  VALIDATED: "Forfait validé",
};

const FEE_STATUS_STYLES: Record<PublicationFeeStatus, string> = {
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  AWAITING_PAYMENT: "bg-slate-100 text-slate-700",
  REJECTED: "bg-red-100 text-red-800",
  VALIDATED: "bg-green-100 text-green-800",
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
  refusee:
    "Œuvre refusée : l'auteur est prévenu. Si un forfait a été versé, remboursez-le et conservez la preuve du remboursement.",
};

const ERRORS: Record<string, string> = {
  confirmation: "Cochez la case de confirmation pour valider.",
  motif: "Indiquez le motif (3 caractères au minimum).",
  etat: "Cette demande a déjà été traitée ou n'est plus dans cet état.",
};

const OPEN_STAGES: EditionStage[] = ["FEE_PENDING", "IN_LAYOUT", "PROOF_PENDING", "CHANGES_REQUESTED"];

export default async function AdminPublicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/publications");

  const rawTab = firstParam(sp.statut);
  const tab: TabKey = TABS.find((item) => item.value === rawTab)?.value ?? "paiement";

  const allProjects = await prisma.editionProject.findMany({
    select: { productId: true, stage: true },
  });

  function idsAt(stages: EditionStage[]): string[] {
    return allProjects.filter((project) => stages.includes(project.stage)).map((project) => project.productId);
  }

  const refusedIds = idsAt(["REFUSED"]);
  const maquetteIds = idsAt(["IN_LAYOUT", "CHANGES_REQUESTED"]);
  const batIds = idsAt(["PROOF_PENDING"]);
  const publishedIds = idsAt(["PUBLISHED"]);

  function whereFor(key: TabKey): Prisma.PublicationFeeWhereInput {
    switch (key) {
      case "paiement":
        return { status: "SUBMITTED", productId: { notIn: refusedIds } };
      case "maquette":
        return { productId: { in: maquetteIds } };
      case "bat":
        return { productId: { in: batIds } };
      case "attente":
        return {
          status: { in: ["AWAITING_PAYMENT", "REJECTED"] },
          productId: { notIn: refusedIds },
        };
      case "publiees":
        return {
          OR: [
            { productId: { in: publishedIds } },
            { status: "VALIDATED", product: { status: "PUBLISHED" } },
          ],
        };
      case "refusees":
        return { productId: { in: refusedIds } };
    }
  }

  const counts = await Promise.all(
    TABS.map((item) => prisma.publicationFee.count({ where: whereFor(item.value) }))
  );
  const countByTab = new Map(TABS.map((item, index) => [item.value, counts[index]]));

  const fees = await prisma.publicationFee.findMany({
    where: whereFor(tab),
    orderBy: tab === "paiement" ? { submittedAt: "asc" } : { createdAt: "desc" },
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
      proofVersion: true,
      proofUploadedAt: true,
      correctionRounds: true,
      changeRequest: true,
      refusalReason: true,
      approvedAt: true,
      approvedByName: true,
      approvedProofVersion: true,
    },
  });
  const projectByProduct = new Map(projects.map((project) => [project.productId, project]));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Éditions à compte d&apos;auteur</h1>
        <p className="mt-1 text-sm text-slate-600">
          Parcours : l&apos;auteur dépose son livre et accepte le contrat, règle le forfait (vous le validez ici),
          vous réalisez la maquette et déposez l&apos;épreuve, l&apos;auteur approuve le bon à tirer : le livre est
          alors publié. Rien n&apos;est publié sans cette approbation.
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
            {item.label} ({countByTab.get(item.value) ?? 0})
          </Link>
        ))}
      </div>

      {fees.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune demande dans cette catégorie.</div>
      ) : (
        <ul className="space-y-4">
          {fees.map((fee) => {
            const project = projectByProduct.get(fee.productId);
            const stage = project?.stage;
            const inLayoutWork =
              stage === "IN_LAYOUT" || stage === "CHANGES_REQUESTED" || stage === "PROOF_PENDING";
            const refundDue =
              stage === "REFUSED" && (fee.status === "VALIDATED" || fee.status === "SUBMITTED");

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
                    {stage && (
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${EDITION_STAGE_STYLES[stage]}`}
                      >
                        {EDITION_STAGE_LABELS[stage]}
                      </span>
                    )}
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${FEE_STATUS_STYLES[fee.status]}`}
                    >
                      {FEE_STATUS_LABELS[fee.status]}
                    </span>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Forfait</dt>
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
                    <dt className="text-xs text-slate-500">Manuscrit déposé</dt>
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

                {fee.status === "REJECTED" && fee.rejectionReason && (
                  <p className="mt-3 text-sm text-red-700">Motif du rejet : {fee.rejectionReason}</p>
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

                {fee.status === "SUBMITTED" && stage !== "REFUSED" && (
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

                {project && inLayoutWork && (
                  <div className="mt-4 space-y-3 rounded-lg border border-slate-300 p-4">
                    <p className="font-semibold">Mise en page et bon à tirer</p>

                    {stage === "CHANGES_REQUESTED" && project.changeRequest && (
                      <div className="rounded border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                        <p className="font-semibold">
                          Corrections demandées par l&apos;auteur (série {project.correctionRounds}) :
                        </p>
                        <p className="mt-1 whitespace-pre-line">{project.changeRequest}</p>
                      </div>
                    )}

                    {project.proofVersion > 0 && (
                      <p className="text-sm text-slate-700">
                        Épreuve actuelle : version {project.proofVersion}
                        {project.proofUploadedAt ? `, déposée le ${formatDate(project.proofUploadedAt)}` : ""}.{" "}
                        <a
                          href={`/api/edition/${fee.productId}/epreuve`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          Ouvrir
                        </a>
                      </p>
                    )}

                    {fee.status === "VALIDATED" ? (
                      <EditionProofForm productId={fee.productId} currentVersion={project.proofVersion} />
                    ) : (
                      <p className="text-sm text-slate-600">
                        Validez d&apos;abord le forfait pour déposer une épreuve.
                      </p>
                    )}
                  </div>
                )}

                {project && OPEN_STAGES.includes(project.stage) && (
                  <form action={refuseEditionAction} className="mt-4 space-y-2">
                    <input type="hidden" name="productId" value={fee.productId} />
                    <label htmlFor={`refuse-${fee.id}`} className="label">
                      Refuser cette œuvre (non-conformité) : motif transmis à l&apos;auteur
                    </label>
                    <input
                      id={`refuse-${fee.id}`}
                      name="reason"
                      type="text"
                      required
                      minLength={3}
                      maxLength={300}
                      className="input"
                    />
                    <p className="text-xs text-slate-500">
                      Si un forfait a été versé, il est à rembourser intégralement (hors du site).
                    </p>
                    <button type="submit" className="btn-secondary text-red-700">
                      Refuser l&apos;œuvre
                    </button>
                  </form>
                )}

                {stage === "PUBLISHED" && project && (
                  <p className="mt-3 text-sm text-slate-600">
                    Bon à tirer (version {project.approvedProofVersion ?? "-"}) approuvé le{" "}
                    {project.approvedAt ? formatDate(project.approvedAt) : "-"} par{" "}
                    {project.approvedByName ?? "-"}.{" "}
                    <Link
                      href={`/catalogue/${fee.product.slug}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Voir la page
                    </Link>
                  </p>
                )}

                {stage === "REFUSED" && project && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-semibold">Œuvre refusée</p>
                    {project.refusalReason && <p className="mt-1">Motif : {project.refusalReason}</p>}
                    {refundDue && (
                      <p className="mt-1 font-semibold">
                        Forfait à rembourser : {formatPrice(fee.amountXof, "XOF")} (référence{" "}
                        {fee.paymentReference ?? "-"}, numéro {fee.payerPhone ?? "-"}).
                      </p>
                    )}
                  </div>
                )}

                {!project && fee.status === "VALIDATED" && fee.product.status === "PUBLISHED" && (
                  <p className="mt-3 text-sm text-slate-600">
                    Ancien dépôt publié.{" "}
                    <Link
                      href={`/catalogue/${fee.product.slug}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Voir la page
                    </Link>
                  </p>
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
            Money, au bon montant. Une référence de transaction ne peut servir qu&apos;une fois.
          </li>
          <li>
            À l&apos;approbation du bon à tirer, le fichier vendu devient <strong>l&apos;épreuve</strong> que vous
            avez déposée ; le manuscrit reste archivé et téléchargeable ici.
          </li>
          <li>
            Contrat : l&apos;auteur dispose de 15 jours pour répondre à une épreuve, et de deux séries de
            corrections incluses. Au-delà, un devis de corrections est à établir avec lui.
          </li>
          <li>
            Un ouvrage dont le forfait n&apos;est pas validé, ou dont le bon à tirer n&apos;est pas approuvé,
            n&apos;apparaît ni dans le catalogue ni dans le plan du site.
          </li>
          <li>Vos propres ouvrages (compte administrateur) sont publiés sans contrat ni forfait.</li>
          <li>Chaque validation, rejet, refus et dépôt d&apos;épreuve est inscrit dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
}
