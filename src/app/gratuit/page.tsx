// src/app/gratuit/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { FREE_WAIT_SECONDS } from "@/lib/free-resources";
import { formatFileSize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Téléchargements gratuits",
  description:
    "PDF gratuits à télécharger : une courte attente avec publicité précède chaque téléchargement.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function GratuitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const where = { isActive: true };
  const total = await prisma.freeResource.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const resources = await prisma.freeResource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      coverImageUrl: true,
      pageCount: true,
      pdfSizeBytes: true,
      downloadCount: true,
    },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Téléchargements gratuits</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Ces PDF sont gratuits. Pour financer le site, une attente de {FREE_WAIT_SECONDS} secondes avec
        publicité précède chaque téléchargement.
      </p>

      <p className="mt-6 text-sm text-slate-600">
        {total === 0
          ? "Aucun PDF gratuit pour le moment."
          : `${total} PDF gratuit${total > 1 ? "s" : ""}.`}
      </p>

      {resources.length > 0 && (
        <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((resource) => (
            <li key={resource.id}>
              <Link
                href={`/gratuit/${resource.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="flex aspect-[3/4] items-center justify-center bg-slate-100">
                  {resource.coverImageUrl ? (
                    <Image
                      src={resource.coverImageUrl}
                      alt={`Couverture de ${resource.title}`}
                      width={300}
                      height={400}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-slate-300">PDF</span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 p-4">
                  <h2 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">
                    {resource.title}
                  </h2>
                  <p className="line-clamp-3 text-sm text-slate-600">{resource.description}</p>
                  <p className="mt-auto pt-2 text-xs text-slate-500">
                    PDF · {formatFileSize(resource.pdfSizeBytes)}
                    {resource.pageCount ? ` · ${resource.pageCount} pages` : ""} ·{" "}
                    {resource.downloadCount} téléchargement{resource.downloadCount > 1 ? "s" : ""}
                  </p>
                  <span className="text-sm font-semibold text-brand-700">Gratuit</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination basePath="/gratuit" params={{}} page={page} totalPages={totalPages} />
    </div>
  );
      }
