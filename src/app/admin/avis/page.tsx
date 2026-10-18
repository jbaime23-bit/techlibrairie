// src/app/admin/avis/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { RatingStars } from "@/components/produits/rating-stars";
import { REVIEW_STATUS_LABELS } from "@/lib/reviews";
import { deleteReviewAction, setReviewStatusAction } from "@/app/admin/avis/actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Avis",
};

export const dynamic = "force-dynamic";

const STATUSES: ReviewStatus[] = ["PUBLISHED", "HIDDEN"];

const STATUS_STYLES: Record<ReviewStatus, string> = {
  PUBLISHED: "bg-green-100 text-green-800",
  HIDDEN: "bg-slate-200 text-slate-700",
};

export default async function AdminAvisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/avis");

  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  const rawStatus = firstParam(sp.statut);
  const status = STATUSES.find((value) => value === rawStatus);

  const where: Prisma.ReviewWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { comment: { contains: q, mode: "insensitive" } },
            { product: { title: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const total = await prisma.review.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    include: {
      product: { select: { title: true, slug: true } },
      user: { select: { name: true, email: true } },
    },
  });

  function filterHref(value?: ReviewStatus): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (value) search.set("statut", value);
    const query = search.toString();
    return query ? `/admin/avis?${query}` : "/admin/avis";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avis des acheteurs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les avis sont publiés immédiatement. Masquez ceux qui sont injurieux, trompeurs ou hors
          sujet : l&apos;auteur ne pourra plus les modifier. La suppression est définitive.
        </p>
      </div>

      <form method="get" action="/admin/avis" className="flex flex-wrap gap-3">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Commentaire, ouvrage ou email de l'auteur"
          className="input max-w-sm"
        />
        {status && <input type="hidden" name="statut" value={status} />}
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={filterHref()} className={status ? "btn-secondary" : "btn-primary"}>
          Tous
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={filterHref(value)}
            className={status === value ? "btn-primary" : "btn-secondary"}
          >
            {REVIEW_STATUS_LABELS[value]}
          </Link>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        {total} avis
      </p>

      {reviews.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucun avis.</div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <RatingStars value={review.rating} />
                    <Link
                      href={`/catalogue/${review.product.slug}#avis`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {review.product.title}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {review.user.name ?? "Sans nom"} · {review.user.email} ·{" "}
                    {formatDate(review.createdAt)}
                    {review.updatedAt.getTime() - review.createdAt.getTime() > 60_000
                      ? ` (modifié le ${formatDate(review.updatedAt)})`
                      : ""}
                  </p>
                </div>

                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[review.status]}`}
                >
                  {REVIEW_STATUS_LABELS[review.status]}
                </span>
              </div>

              {review.comment ? (
                <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-800">
                  {review.comment}
                </p>
              ) : (
                <p className="mt-3 text-sm italic text-slate-500">Note sans commentaire.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={setReviewStatusAction}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={review.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED"}
                  />
                  <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                    {review.status === "PUBLISHED" ? "Masquer" : "Rendre visible"}
                  </button>
                </form>

                <form action={deleteReviewAction}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <button
                    type="submit"
                    className="btn-secondary px-3 py-1 text-xs text-red-700"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/admin/avis"
        params={{ q: q || undefined, statut: status }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
              }
