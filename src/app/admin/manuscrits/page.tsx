// src/app/admin/manuscrits/page.tsx
// Examen éditorial des manuscrits soumis à compte d'éditeur, et suivi du contrat d'édition de chaque manuscrit retenu.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ManuscriptStatus, PublishingCapacity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  decideManuscriptAction,
  startManuscriptReviewAction,
} from "@/app/admin/manuscrits/actions";
import { getEditionOffers } from "@/lib/edition-offers";
import { MANUSCRIPT_STATUS_LABELS, MANUSCRIPT_STATUS_STYLES } from "@/lib/manuscript-validation";
import { formatDate, formatFileSize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Manuscrits à compte d'éditeur",
};

export const dynamic = "force-dynamic";

type TabKey = "examen" | "retenus" | "refuses";

const TABS: { value: TabKey; label: string; statuses: ManuscriptStatus[] }[] = [
  { value: "examen", label: "À examiner", statuses: ["SUBMITTED", "IN_REVIEW"] },
  { value: "retenus", label: "Retenus", statuses: ["ACCEPTED"] },
  { value: "refuses", label: "Non retenus", statuses: ["REJECTED"] },
];

const CAPACITY_LABELS: Record<PublishingCapacity, string> = {
  AUTHOR: "Auteur",
  INDEPENDENT_PUBLISHER: "Éditeur indépendant",
  THIRD_PARTY_SELLER: "Titulaire des droits (ayant droit)",
};

const LANGUAGE_LABELS: Record<string, string> = { fr: "Français", en: "Anglais" };

const MESSAGES: Record<string, string> = {
  examen: "Manuscrit mis en cours d'examen.",
  retenu:
    "Manuscrit retenu : son contrat d'édition est généré et l'auteur est prévenu. Il le signe en ligne, sans rendez-vous.",
  refuse: "Manuscrit refusé : l'auteur est prévenu avec votre message.",
};

const ERRORS: Record<string, string> = {
  motif: "Un refus doit être motivé : 10 caractères au minimum.",
  etat: "Ce manuscrit a déjà été traité ou n'est plus dans cet état.",
};

export default async function AdminManuscritsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/manuscrits");

  const rawTab = firstParam(sp.statut);
  const tab = TABS.find((item) => item.value === rawTab) ?? TABS[0];
  const defaultPercent = getEditionOffers().publisherRoyaltyPercent;

  const [groups, submissions] = await Promise.all([
    prisma.manuscriptSubmission.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.manuscriptSubmission.findMany({
      where: { status: { in: tab.statuses } },
      orderBy: tab.value === "examen" ? { createdAt: "asc" } : { decidedAt: "desc" },
      take: 50,
    }),
  ]);

  const countByStatus = new Map(groups.map((group) => [group.status, group._count._all]));
  const countFor = (statuses: ManuscriptStatus[]): number =>
    statuses.reduce((total, status) => total + (countByStatus.get(status) ?? 0), 0);

  const sellerIds = Array.from(new Set(submissions.map((submission) => submission.sellerId)));
  const categoryIds = Array.from(
    new Set(submissions.map((submission) => submission.categoryId).filter((id): id is string => id !== null))
  );
  const submissionIds = submissions.map((submission) => submission.id);

  const [sellers, categories, contracts] = await Promise.all([
    sellerIds.length
      ? prisma.sellerProfile.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, displayName: true, user: { select: { email: true } } },
        })
      : Promise.resolve([]),
    categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    submissionIds.length
      ? prisma.publisherContract.findMany({
          where: { submissionId: { in: submissionIds } },
          select: {
            submissionId: true,
            royaltyPercent: true,
            offeredAt: true,
            acceptedAt: true,
            signerName: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));
  const contractBySubmission = new Map(contracts.map((contract) => [contract.submissionId, contract]));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manuscrits à compte d&apos;éditeur</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manuscrits soumis à l&apos;examen éditorial, sans frais pour l&apos;auteur. Vous téléchargez le manuscrit,
          l&apos;examinez, puis vous le retenez ou le refusez avec un message. Un manuscrit retenu reçoit
          automatiquement son contrat d&apos;édition, que l&apos;auteur signe en ligne.
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
            href={`/admin/manuscrits?statut=${item.value}`}
            className={tab.value === item.value ? "btn-primary" : "btn-secondary"}
          >
            {item.label} ({countFor(item.statuses)})
          </Link>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucun manuscrit dans cette catégorie.</div>
      ) : (
        <ul className="space-y-4">
          {submissions.map((submission) => {
            const seller = sellerById.get(submission.sellerId);
            const open = submission.status === "SUBMITTED" || submission.status === "IN_REVIEW";
            const contract = contractBySubmission.get(submission.id);

            return (
              <li key={submission.id} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {submission.coverImageUrl ? (
                      <Image
                        src={submission.coverImageUrl}
                        alt={`Couverture de ${submission.title}`}
                        width={56}
                        height={80}
                        className="h-20 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                        PDF
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{submission.title}</p>
                      <p className="text-xs text-slate-500">
                        {seller?.displayName ?? "Auteur inconnu"} · {seller?.user.email ?? "-"}
                      </p>
                      <p className="text-xs text-slate-500">Soumis le {formatDate(submission.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`badge ${MANUSCRIPT_STATUS_STYLES[submission.status]}`}>
                    {MANUSCRIPT_STATUS_LABELS[submission.status]}
                  </span>
                </div>

                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Auteur affiché</dt>
                    <dd>{submission.authorName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Qualité</dt>
                    <dd>{CAPACITY_LABELS[submission.capacity]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Catégorie</dt>
                    <dd>{submission.categoryId ? (categoryById.get(submission.categoryId) ?? "-") : "Sans catégorie"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Langue et pages</dt>
                    <dd>
                      {LANGUAGE_LABELS[submission.language] ?? submission.language}
                      {submission.pageCount ? ` · ${submission.pageCount} pages` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Manuscrit</dt>
                    <dd>{formatFileSize(submission.manuscriptSizeBytes)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Droits déclarés le</dt>
                    <dd>{formatDate(submission.rightsAcceptedAt)}</dd>
                  </div>
                </dl>

                <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <summary className="cursor-pointer font-semibold">Résumé de l&apos;auteur</summary>
                  <p className="mt-2 whitespace-pre-line text-slate-700">{submission.description}</p>
                </details>

                <p className="text-sm">
                  <a
                    href={`/api/admin/manuscrit/${submission.id}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Télécharger le manuscrit
                  </a>
                </p>

                {submission.decisionMessage && (
                  <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Message transmis : {submission.decisionMessage}
                  </p>
                )}

                {submission.status === "ACCEPTED" && (
                  <div
                    className={`rounded-xl border p-3 text-sm ${
                      contract?.acceptedAt
                        ? "border-green-200 bg-green-50 text-green-900"
                        : "border-orange-200 bg-orange-50 text-orange-900"
                    }`}
                  >
                    {contract ? (
                      <>
                        <p className="font-semibold">
                          {contract.acceptedAt
                            ? `Contrat signé le ${formatDate(contract.acceptedAt)} par ${contract.signerName ?? "-"}`
                            : `Contrat envoyé le ${formatDate(contract.offeredAt)} : en attente de signature`}
                        </p>
                        <p className="mt-1">
                          Redevance de l&apos;auteur : {contract.royaltyPercent} % du prix public hors taxes.{" "}
                          <a
                            href={`/api/contrat/editeur/${submission.id}`}
                            className="font-semibold underline"
                          >
                            Télécharger le contrat (PDF)
                          </a>
                        </p>
                        {contract.acceptedAt && (
                          <p className="mt-1">Vous pouvez lancer l&apos;édition du livre.</p>
                        )}
                      </>
                    ) : (
                      <p className="font-semibold">Aucun contrat généré pour ce manuscrit.</p>
                    )}
                  </div>
                )}

                {submission.status === "SUBMITTED" && (
                  <form action={startManuscriptReviewAction}>
                    <input type="hidden" name="submissionId" value={submission.id} />
                    <button type="submit" className="btn-secondary">
                      Mettre en cours d&apos;examen
                    </button>
                  </form>
                )}

                {open && (
                  <form action={decideManuscriptAction} className="space-y-3 rounded-xl border border-slate-300 p-4">
                    <input type="hidden" name="submissionId" value={submission.id} />

                    <div>
                      <label htmlFor={`royalty-${submission.id}`} className="label">
                        Redevance de l&apos;auteur si vous le retenez (% du prix public hors taxes)
                      </label>
                      <input
                        id={`royalty-${submission.id}`}
                        name="royaltyPercent"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={60}
                        defaultValue={defaultPercent}
                        className="input max-w-[8rem]"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Elle figure dans le contrat généré. L&apos;auteur ne pourra pas la modifier.
                      </p>
                    </div>

                    <div>
                      <label htmlFor={`message-${submission.id}`} className="label">
                        Message à l&apos;auteur (obligatoire pour un refus, 10 caractères au minimum)
                      </label>
                      <textarea
                        id={`message-${submission.id}`}
                        name="message"
                        rows={3}
                        maxLength={1500}
                        className="input"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="submit" name="decision" value="accept" className="btn-primary">
                        Retenir et envoyer le contrat
                      </button>
                      <button type="submit" name="decision" value="reject" className="btn-secondary text-red-700">
                        Refuser
                      </button>
                    </div>
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
            La formule à compte d&apos;éditeur ne demande <strong>aucun paiement</strong> à la soumission : l&apos;auteur
            déclare ses droits et accepte l&apos;examen.
          </li>
          <li>
            « Retenir » génère le <strong>contrat d&apos;édition</strong> avec la redevance que vous avez saisie. L&apos;auteur
            le lit et le signe en ligne depuis son espace, puis le télécharge en PDF. Le texte proposé et la
            signature sont archivés avec leur empreinte.
          </li>
          <li>
            Ce contrat est un <strong>modèle à faire relire par votre avocat</strong> avant le premier usage réel
            (durée, redevance, droits cédés).
          </li>
          <li>
            Le suivi des droits d&apos;auteur dus sur les ventes de ces livres (état annuel, versements) n&apos;est pas
            encore automatisé dans le site.
          </li>
          <li>Les manuscrits sont stockés en accès privé ; chaque téléchargement est inscrit dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
}
