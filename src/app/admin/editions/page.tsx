// src/app/admin/editions/page.tsx
// File de travail des éditions à compte d'auteur : manuscrit, dépôt de l'épreuve, suivi du bon à tirer,
// refus d'une œuvre.
import type { Metadata } from "next";
import Link from "next/link";
import type { EditionStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import { ProofUploadForm } from "@/components/admin/proof-upload-form";
import { refuseEditionAction } from "@/app/admin/editions/actions";
import {
  INCLUDED_CORRECTION_ROUNDS,
  LAYOUT_DELAY_DAYS,
  PROOF_REVIEW_DAYS,
  addDays,
} from "@/lib/edition-proof";
import { formatDate, formatFileSize, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Éditions à compte d'auteur",
};

export const dynamic = "force-dynamic";

const TABS: { value: string; label: string; stages: EditionStage[] }[] = [
  { value: "traiter", label: "À traiter", stages: ["IN_LAYOUT", "CHANGES_REQUESTED"] },
  { value: "bat", label: "Bon à tirer en attente", stages: ["PROOF_PENDING"] },
  { value: "forfait", label: "Forfait à régler", stages: ["FEE_PENDING"] },
  { value: "publies", label: "Publiés", stages: ["PUBLISHED"] },
  { value: "refuses", label: "Refusés", stages: ["REFUSED"] },
];

const STAGE_LABELS: Record<EditionStage, string> = {
  FEE_PENDING: "Forfait à régler",
  IN_LAYOUT: "En maquette",
  PROOF_PENDING: "Bon à tirer à valider",
  CHANGES_REQUESTED: "Corrections demandées",
  PUBLISHED: "Publié",
  REFUSED: "Refusé",
};

const STAGE_STYLES: Record<EditionStage, string> = {
  FEE_PENDING: "bg-slate-100 text-slate-700",
  IN_LAYOUT: "bg-blue-100 text-blue-800",
  PROOF_PENDING: "bg-yellow-100 text-yellow-800",
  CHANGES_REQUESTED: "bg-orange-100 text-orange-800",
  PUBLISHED: "bg-green-100 text-green-800",
  REFUSED: "bg-red-100 text-red-800",
};

const MESSAGES: Record<string, string> = {
  refusee: "Œuvre refusée : l'auteur a été prévenu.",
};

const ERRORS: Record<string, string> = {
  confirmation: "Cochez la case de confirmation pour refuser.",
  motif: "Indiquez le motif du refus (3 caractères au minimum).",
  remboursement:
    "Le forfait a été versé : indiquez la référence du remboursement (3 caractères au minimum) après l'avoir effectué.",
  etat: "Cette édition est déjà publiée ou refusée.",
};

export default async function AdminEditionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/editions");

  const rawTab = firstParam(sp.onglet);
  const tab = TABS.find((item) => item.value === rawTab) ?? TABS[0];

  const groups = await prisma.editionProject.groupBy({ by: ["stage"], _count: { _all: true } });
  const countByStage = new Map(groups.map((group) => [group.stage, group._count._all]));

  const projects = await prisma.editionProject.findMany({
    where: { stage: { in: tab.stages } },
    orderBy: { updatedAt: tab.value === "publies" || tab.value === "refuses" ? "desc" : "asc" },
    take: 50,
  });

  const products = await prisma.product.findMany({
    where: { id: { in: projects.map((project) => project.productId) } },
    select: {
      id: true,
      title: true,
      slug: true,
      authorName: true,
      isbn: true,
      pdfSizeBytes: true,
      seller: { select: { displayName: true, user: { select: { email: true } } } },
      publicationFee: {
        select: { status: true, amountXof: true, validatedAt: true, paymentReference: true },
      },
    },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;
  const now = Date.now();

  function countFor(stages: EditionStage[]): number {
    return stages.reduce((sum, stage) => sum + (countByStage.get(stage) ?? 0), 0);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Éditions à compte d&apos;auteur</h1>
        <p className="mt-1 text-sm text-slate-600">
          Une fois le forfait validé (page Publications), téléchargez le manuscrit, réalisez la mise en page,
          puis déposez l&apos;épreuve ici : l&apos;auteur est prévenu, la relit, puis l&apos;approuve ou demande des
          corrections. Le livre n&apos;est publié qu&apos;après son approbation.
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
            href={`/admin/editions?onglet=${item.value}`}
            className={tab.value === item.value ? "btn-primary" : "btn-secondary"}
          >
            {item.label} ({countFor(item.stages)})
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune édition dans cette catégorie.</div>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => {
            const product = productById.get(project.productId);
            const fee = product?.publicationFee ?? null;
            const open = project.stage !== "PUBLISHED" && project.stage !== "REFUSED";
            const layoutDue =
              fee?.validatedAt && (project.stage === "IN_LAYOUT" || project.stage === "CHANGES_REQUESTED")
                ? addDays(fee.validatedAt, LAYOUT_DELAY_DAYS)
                : null;
            const reminderDue =
              project.stage === "PROOF_PENDING" && project.proofUploadedAt
                ? addDays(project.proofUploadedAt, PROOF_REVIEW_DAYS)
                : null;

            return (
              <li key={project.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{product?.title ?? "Ouvrage supprimé"}</p>
                    <p className="text-xs text-slate-500">
                      {product
                        ? `${product.seller.displayName} · ${product.seller.user.email}`
                        : project.signerEmail}
                    </p>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STAGE_STYLES[project.stage]}`}
                  >
                    {STAGE_LABELS[project.stage]}
                  </span>
                </div>

                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Auteur et ISBN</dt>
                    <dd>
                      {product?.authorName ?? "non indiqué"} · ISBN {product?.isbn ?? "non renseigné"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Forfait</dt>
                    <dd>
                      {fee ? formatPrice(fee.amountXof, "XOF") : "-"} ·{" "}
                      {fee?.status === "VALIDATED" ? "validé" : "non validé"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Contrat accepté</dt>
                    <dd>
                      v{project.contractVersion}, {formatDate(project.contractAcceptedAt)} (
                      {project.signerName})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Manuscrit</dt>
                    <dd>{product ? formatFileSize(product.pdfSizeBytes) : "-"}</dd>
                  </div>
                </dl>

                {layoutDue && (
                  <p
                    className={`mt-3 text-sm ${
                      layoutDue.getTime() < now ? "font-semibold text-red-700" : "text-slate-600"
                    }`}
                  >
                    Délai indicatif de {LAYOUT_DELAY_DAYS} jours : échéance le {formatDate(layoutDue)}
                    {layoutDue.getTime() < now ? " (dépassée)" : ""}.
                  </p>
                )}

                {project.stage === "CHANGES_REQUESTED" && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
                    <p className="font-semibold text-orange-900">
                      Corrections demandées (série {project.correctionRounds} sur{" "}
                      {INCLUDED_CORRECTION_ROUNDS} incluses)
                    </p>
                    <p className="mt-1 whitespace-pre-line text-orange-900">{project.changeRequest}</p>
                  </div>
                )}

                {project.stage === "PROOF_PENDING" && (
                  <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                    <p>
                      Épreuve version {project.proofVersion} envoyée
                      {project.proofUploadedAt ? ` le ${formatDate(project.proofUploadedAt)}` : ""}. L&apos;auteur
                      dispose de {PROOF_REVIEW_DAYS} jours pour répondre
                      {reminderDue ? ` (relance à prévoir après le ${formatDate(reminderDue)})` : ""}.
                    </p>
                    <p className="mt-1">
                      <a
                        href={`/api/admin/edition/${project.productId}/epreuve`}
                        className="font-semibold underline"
                      >
                        Télécharger l&apos;épreuve envoyée
                      </a>
                    </p>
                  </div>
                )}

                {project.stage === "PUBLISHED" && (
                  <p className="mt-3 text-sm text-slate-600">
                    Épreuve version {project.approvedProofVersion ?? "-"} approuvée
                    {project.approvedAt ? ` le ${formatDate(project.approvedAt)}` : ""} par{" "}
                    {project.approvedByName ?? "-"}.{" "}
                    {product && (
                      <Link
                        href={`/catalogue/${product.slug}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        Voir la page du livre
                      </Link>
                    )}
                  </p>
                )}

                {project.stage === "REFUSED" && project.refusalReason && (
                  <p className="mt-3 text-sm text-red-700">Motif du refus : {project.refusalReason}</p>
                )}

                {project.stage !== "FEE_PENDING" && (
                  <p className="mt-3 text-sm">
                    <a
                      href={`/api/admin/edition/${project.productId}/manuscrit`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Télécharger le manuscrit déposé par l&apos;auteur
                    </a>
                  </p>
                )}

                {(project.stage === "IN_LAYOUT" ||
                  project.stage === "CHANGES_REQUESTED" ||
                  project.stage === "PROOF_PENDING") && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <ProofUploadForm
                      productId={project.productId}
                      nextVersion={project.proofVersion + 1}
                    />
                    {project.stage === "PROOF_PENDING" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Déposer une nouvelle épreuve remplace la précédente et prévient à nouveau l&apos;auteur.
                      </p>
                    )}
                  </div>
                )}

                {open && (
                  <form action={refuseEditionAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    <input type="hidden" name="productId" value={project.productId} />
                    <p className="text-sm font-semibold">Refuser cette œuvre (non-conformité)</p>

                    <div>
                      <label htmlFor={`reason-${project.id}`} className="label">
                        Motif (transmis à l&apos;auteur)
                      </label>
                      <input
                        id={`reason-${project.id}`}
                        name="reason"
                        type="text"
                        required
                        minLength={3}
                        maxLength={300}
                        className="input"
                      />
                    </div>

                    {fee?.status === "VALIDATED" && (
                      <div>
                        <label htmlFor={`refund-${project.id}`} className="label">
                          Référence du remboursement du forfait (Mobile Money, à effectuer avant de refuser)
                        </label>
                        <input
                          id={`refund-${project.id}`}
                          name="refundReference"
                          type="text"
                          required
                          minLength={3}
                          maxLength={100}
                          className="input"
                        />
                      </div>
                    )}

                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                      <span>Je confirme le refus : l&apos;auteur en est informé et le livre ne sera pas publié.</span>
                    </label>

                    <button type="submit" className="btn-secondary text-red-700">
                      Refuser l&apos;œuvre
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
            Le PDF vendu est <strong>l&apos;épreuve approuvée par l&apos;auteur</strong>, pas son manuscrit. Le
            manuscrit est conservé séparément.
          </li>
          <li>
            Le contrat prévoit {INCLUDED_CORRECTION_ROUNDS} séries de corrections incluses : au-delà,
            l&apos;auteur est invité à vous contacter pour un devis.
          </li>
          <li>
            Aucune relance automatique : repérez les épreuves restées sans réponse après {PROOF_REVIEW_DAYS} jours
            et relancez l&apos;auteur par email.
          </li>
          <li>
            Le remboursement d&apos;un forfait se fait hors du site (Mobile Money) : saisissez sa référence au
            moment du refus.
          </li>
          <li>Chaque dépôt d&apos;épreuve, chaque téléchargement de manuscrit et chaque refus sont inscrits dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
  }
