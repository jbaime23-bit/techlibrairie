// src/app/edition/espace/page.tsx
// Espace auteur : photo, éditions à compte d'auteur et manuscrits soumis à l'examen éditorial.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { AuthorPhotoCard } from "@/components/edition/author-photo-card";
import { EDITION_STAGE_LABELS, EDITION_STAGE_STYLES } from "@/lib/edition-labels";
import { MANUSCRIPT_STATUS_LABELS, MANUSCRIPT_STATUS_STYLES } from "@/lib/manuscript-validation";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mon espace auteur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EspaceAuteurPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/edition/connexion?callbackUrl=${encodeURIComponent("/edition/espace")}`);
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true, status: true, avatarUrl: true },
  });

  if (!seller) {
    return (
      <div className="container-page py-10 sm:py-14">
        <div className="card mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-extrabold">Activez votre espace auteur</h1>
          <p className="mt-2 text-sm text-slate-600">
            Votre compte est un compte acheteur. Ouvrez votre espace auteur pour déposer un manuscrit.
          </p>
          <div className="mt-6">
            <Link href="/publier" className="btn-primary">
              Ouvrir mon espace auteur
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [products, submissions] = await Promise.all([
    prisma.product.findMany({
      where: { sellerId: seller.id, kind: "BOOK_EDITION" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, slug: true, status: true, publishedAt: true },
    }),
    prisma.manuscriptSubmission.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        decisionMessage: true,
        decidedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const projects = products.length
    ? await prisma.editionProject.findMany({
        where: { productId: { in: products.map((product) => product.id) } },
        select: { productId: true, stage: true },
      })
    : [];
  const stageByProduct = new Map(projects.map((project) => [project.productId, project.stage]));

  const justSubmitted = firstParam(sp.message) === "soumis";

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-brand-700">Espace auteur</p>
            <h1 className="mt-1 text-3xl font-extrabold">Bonjour, {seller.displayName}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Retrouvez ici vos éditions et vos manuscrits, et suivez chaque étape.
            </p>
          </div>
          <Link href="/edition/deposer" className="btn-accent">
            Déposer un nouveau manuscrit
          </Link>
        </div>

        {justSubmitted && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
            <p className="font-semibold">Votre manuscrit a bien été reçu.</p>
            <p className="mt-1">
              Notre équipe éditoriale l&apos;examine. Vous serez informé de la décision, ici et par email.
            </p>
          </div>
        )}

        <AuthorPhotoCard currentUrl={seller.avatarUrl} displayName={seller.displayName} />

        <section>
          <h2 className="text-xl font-extrabold">Éditions à compte d&apos;auteur</h2>

          {products.length === 0 ? (
            <p className="card mt-4 text-sm text-slate-600">
              Aucune édition pour le moment. Déposez votre premier manuscrit pour commencer.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {products.map((product) => {
                const stage = stageByProduct.get(product.id);
                const inProgress = product.status === "PENDING_PAYMENT";

                return (
                  <li key={product.id} className="card flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{product.title}</p>
                      <p className="text-xs text-slate-500">
                        {inProgress ? "Édition en cours" : `Publié le ${formatDate(product.publishedAt)}`}
                      </p>
                      <span
                        className={`badge mt-2 ${
                          stage ? EDITION_STAGE_STYLES[stage] : "bg-green-100 text-green-800"
                        }`}
                      >
                        {stage ? EDITION_STAGE_LABELS[stage] : product.status === "PUBLISHED" ? "Publié" : "Retiré"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {inProgress ? (
                        <Link href={`/vendeur/publication/${product.id}`} className="btn-primary px-3 py-1.5 text-xs">
                          Suivre mon édition
                        </Link>
                      ) : (
                        <>
                          {product.status === "PUBLISHED" && (
                            <Link href={`/catalogue/${product.slug}`} className="btn-secondary px-3 py-1.5 text-xs">
                              Voir la page
                            </Link>
                          )}
                          <Link
                            href={`/vendeur/impression/${product.id}`}
                            className="btn-secondary px-3 py-1.5 text-xs"
                          >
                            Version imprimée
                          </Link>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xl font-extrabold">Manuscrits soumis à l&apos;examen éditorial</h2>
          <p className="mt-1 text-sm text-slate-600">Formule à compte d&apos;éditeur : aucun frais, une sélection éditoriale.</p>

          {submissions.length === 0 ? (
            <p className="card mt-4 text-sm text-slate-600">Aucun manuscrit soumis pour le moment.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {submissions.map((submission) => (
                <li key={submission.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{submission.title}</p>
                      <p className="text-xs text-slate-500">Soumis le {formatDate(submission.createdAt)}</p>
                    </div>
                    <span className={`badge ${MANUSCRIPT_STATUS_STYLES[submission.status]}`}>
                      {MANUSCRIPT_STATUS_LABELS[submission.status]}
                    </span>
                  </div>

                  {submission.decisionMessage && (
                    <p className="mt-3 whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {submission.decisionMessage}
                    </p>
                  )}

                  {submission.status === "ACCEPTED" && (
                    <p className="mt-3 text-sm font-semibold text-green-700">
                      Bonne nouvelle : nous vous contactons pour vous proposer un contrat d&apos;édition.
                    </p>
                  )}

                  {submission.status === "REJECTED" && (
                    <p className="mt-3 text-sm text-slate-600">
                      Vous pouvez faire éditer ce livre à compte d&apos;auteur : vous gardez vos droits et tous vos
                      gains.{" "}
                      <Link href="/edition/deposer?formule=auteur" className="font-semibold text-brand-700 hover:underline">
                        Déposer à compte d&apos;auteur
                      </Link>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm text-slate-500">
          Vous vendez aussi des documents PDF dans la boutique ?{" "}
          <Link href="/vendeur" className="font-semibold text-teal-700 hover:underline">
            Ouvrir mon espace vendeur
          </Link>
          .
        </p>
      </div>
    </div>
  );
    }
