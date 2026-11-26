// src/app/admin/droits/page.tsx
// Droits d'auteur des livres à compte d'éditeur : rattachement d'un livre au contrat signé de son auteur,
// droits acquis par accord, relevés annuels.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import { linkRoyaltyAgreementAction, unlinkRoyaltyAgreementAction } from "@/app/admin/droits/actions";
import { PAYOUT_HOLD_DAYS } from "@/lib/payouts";
import { computeRoyalties } from "@/lib/royalties";
import { formatXofAmount } from "@/lib/edition-offers";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Droits d'auteur",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  lie: "Livre lié au contrat : les droits d'auteur sont calculés sur toutes ses ventes depuis sa mise en ligne.",
  delie: "Accord supprimé : les droits de ce livre ne courent plus.",
};

const ERRORS: Record<string, string> = {
  choix: "Choisissez un livre et un contrat.",
  confirmation: "Cochez la case de vérification.",
  livre: "Ce livre n'est pas un livre à compte d'éditeur (badge « TechLibrairie Édition »).",
  contrat: "Ce contrat n'est pas signé par l'auteur.",
  deja: "Ce livre ou ce contrat est déjà lié.",
  introuvable: "Accord introuvable.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

export default async function AdminDroitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/droits");

  const threshold = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
  const currentYear = new Date().getUTCFullYear();

  const [agreements, publisherBooks, signedContracts] = await Promise.all([
    prisma.royaltyAgreement.findMany({
      where: { active: true },
      orderBy: { linkedAt: "desc" },
      take: 200,
    }),
    prisma.product.findMany({
      where: { kind: "BOOK_EDITION", editionModel: "PUBLISHER_ACCOUNT" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, authorName: true, status: true },
    }),
    prisma.publisherContract.findMany({
      where: { acceptedAt: { not: null } },
      orderBy: { acceptedAt: "desc" },
      take: 200,
      select: {
        submissionId: true,
        workTitle: true,
        signerName: true,
        royaltyPercent: true,
        acceptedAt: true,
      },
    }),
  ]);

  const report = await computeRoyalties({ releaseThreshold: threshold });
  const lineByProduct = new Map(report.lines.map((line) => [line.productId, line]));

  const linkedProducts = new Set(agreements.map((agreement) => agreement.productId));
  const linkedContracts = new Set(agreements.map((agreement) => agreement.submissionId));

  const unlinkedBooks = publisherBooks.filter((book) => !linkedProducts.has(book.id));
  const freeContracts = signedContracts.filter((contract) => !linkedContracts.has(contract.submissionId));

  const sellerIds = Array.from(new Set(agreements.map((agreement) => agreement.authorSellerId)));
  const sellers = sellerIds.length
    ? await prisma.sellerProfile.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, displayName: true, user: { select: { email: true } } },
      })
    : [];
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));

  const productTitle = new Map(publisherBooks.map((book) => [book.id, book.title]));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Droits d&apos;auteur</h1>
        <p className="mt-1 text-sm text-slate-600">
          Droits dus aux auteurs des livres à compte d&apos;éditeur : une redevance sur le prix public hors taxes de
          chaque exemplaire vendu (numérique et imprimé), au taux de leur contrat signé. Les droits s&apos;ajoutent au
          solde de l&apos;auteur : il en demande le versement comme pour ses autres revenus, et vous le payez dans
          Versements.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Livres à lier à un contrat ({unlinkedBooks.length})</h2>

        {unlinkedBooks.length === 0 ? (
          <div className="card text-sm text-slate-600">
            Aucun livre à compte d&apos;éditeur sans accord de droits. Un livre apparaît ici quand vous le mettez en
            ligne avec le badge « TechLibrairie Édition » (Administration, Mise en ligne).
          </div>
        ) : freeContracts.length === 0 ? (
          <div className="card text-sm text-slate-600">
            {unlinkedBooks.length} livre{unlinkedBooks.length > 1 ? "s" : ""} à compte d&apos;éditeur
            {unlinkedBooks.length > 1 ? " attendent" : " attend"} un contrat, mais aucun contrat signé disponible : un
            auteur doit d&apos;abord signer son contrat (Administration, Manuscrits).
          </div>
        ) : (
          <ul className="space-y-4">
            {unlinkedBooks.map((book) => (
              <li key={book.id} className="card space-y-3">
                <div>
                  <p className="font-semibold">{book.title}</p>
                  <p className="text-xs text-slate-500">
                    {book.authorName ?? "Auteur non indiqué"} ·{" "}
                    {book.status === "PUBLISHED" ? "en vente" : "pas encore en vente"}
                  </p>
                </div>

                <form action={linkRoyaltyAgreementAction} className="space-y-3">
                  <input type="hidden" name="productId" value={book.id} />

                  <div>
                    <label htmlFor={`contract-${book.id}`} className="label">
                      Contrat signé de l&apos;auteur
                    </label>
                    <select id={`contract-${book.id}`} name="submissionId" required defaultValue="" className="input">
                      <option value="" disabled>
                        Choisir le contrat...
                      </option>
                      {freeContracts.map((contract) => (
                        <option key={contract.submissionId} value={contract.submissionId}>
                          {contract.workTitle} · signé par {contract.signerName ?? "-"}
                          {contract.acceptedAt ? ` le ${formatDate(contract.acceptedAt)}` : ""} · {contract.royaltyPercent} %
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                    <span>
                      J&apos;ai vérifié que ce contrat est bien celui de l&apos;auteur de ce livre : les droits seront
                      calculés sur toutes ses ventes.
                    </span>
                  </label>

                  <button type="submit" className="btn-primary">
                    Lier le livre au contrat
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Accords de droits ({agreements.length})</h2>

        {agreements.length === 0 ? (
          <div className="card text-sm text-slate-600">Aucun accord pour le moment.</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="card text-center">
                <p className="text-xs text-slate-500">Droits acquis par tous les auteurs</p>
                <p className="mt-1 text-xl font-extrabold text-brand-700">{formatXofAmount(report.earnedXof)}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-slate-500">Dont déjà retirables</p>
                <p className="mt-1 text-xl font-extrabold text-green-700">{formatXofAmount(report.releasedXof)}</p>
              </div>
            </div>

            <ul className="space-y-4">
              {agreements.map((agreement) => {
                const line = lineByProduct.get(agreement.productId);
                const seller = sellerById.get(agreement.authorSellerId);

                return (
                  <li key={agreement.id} className="card space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{line?.title ?? productTitle.get(agreement.productId) ?? "Ouvrage"}</p>
                        <p className="text-xs text-slate-500">
                          {seller?.displayName ?? "Auteur"} · {seller?.user.email ?? "-"} · contrat version{" "}
                          {agreement.contractVersion} · lié le {formatDate(agreement.linkedAt)}
                        </p>
                      </div>
                      <span className="badge bg-accent-100 text-accent-800">{agreement.royaltyPercent} %</span>
                    </div>

                    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Numérique</dt>
                        <dd>
                          {(line?.digitalCopies ?? 0).toLocaleString("fr-FR")} ex. ·{" "}
                          {formatXofAmount(line?.digitalRoyaltyXof ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Imprimé</dt>
                        <dd>
                          {(line?.printCopies ?? 0).toLocaleString("fr-FR")} ex. ·{" "}
                          {formatXofAmount(line?.printRoyaltyXof ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Droits acquis</dt>
                        <dd className="font-bold">{formatXofAmount(line?.earnedXof ?? 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Retirables</dt>
                        <dd className="font-bold">{formatXofAmount(line?.releasedXof ?? 0)}</dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {[currentYear, currentYear - 1].map((year) => (
                        <a
                          key={year}
                          href={`/api/droits/releve/${year}?auteur=${agreement.authorSellerId}`}
                          className="btn-secondary px-3 py-1.5"
                        >
                          Relevé {year}
                        </a>
                      ))}
                    </div>

                    <form action={unlinkRoyaltyAgreementAction} className="space-y-2 border-t border-slate-100 pt-3">
                      <input type="hidden" name="agreementId" value={agreement.id} />
                      <label className="flex items-start gap-2 text-xs text-slate-600">
                        <input type="checkbox" name="confirm" value="oui" required className="mt-0.5" />
                        <span>Délier ce livre de son contrat (erreur de rattachement ou fin du contrat).</span>
                      </label>
                      <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                        Délier le livre
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Base de calcul : prix public hors taxes de chaque exemplaire vendu et payé, <strong>livraison exclue</strong>,
            commandes remboursées ou annulées exclues, exemplaires d&apos;auteur exclus. Les droits sont arrondis à
            l&apos;entier inférieur, vente par vente.
          </li>
          <li>
            Les droits d&apos;auteur sont <strong>une charge de TechLibrairie Édition</strong> : ils ne sont pas retirés du
            solde du profil sous lequel le livre est vendu (le vôtre). Seul le solde de l&apos;auteur augmente.
          </li>
          <li>
            Si le compte d&apos;un auteur est supprimé, ses droits ne s&apos;arrêtent pas tout seuls : déliez alors son
            livre ici.
          </li>
          <li>Chaque rattachement et chaque rupture de lien sont inscrits dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
        }
