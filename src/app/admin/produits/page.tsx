// src/app/admin/produits/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { setProductStatusAction } from "@/app/admin/actions";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Produits",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ProductStatus, string> = {
  PUBLISHED: "En vente",
  UNPUBLISHED: "Retiré",
  SUSPENDED: "Suspendu",
};

const STATUS_STYLES: Record<ProductStatus, string> = {
  PUBLISHED: "bg-green-100 text-green-800",
  UNPUBLISHED: "bg-slate-100 text-slate-700",
  SUSPENDED: "bg-red-100 text-red-800",
};

const STATUSES: ProductStatus[] = ["PUBLISHED", "UNPUBLISHED", "SUSPENDED"];

export default async function AdminProduitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/produits");

  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  const rawStatus = firstParam(sp.statut);
  const status = STATUSES.find((value) => value === rawStatus);

  const where: Prisma.ProductWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { seller: { displayName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    include: {
      seller: { select: { displayName: true } },
      category: { select: { name: true } },
    },
  });

  function filterHref(value?: ProductStatus): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (value) search.set("statut", value);
    const query = search.toString();
    return query ? `/admin/produits?${query}` : "/admin/produits";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Produits</h1>

      <form method="get" action="/admin/produits" className="flex flex-wrap gap-3">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Titre ou vendeur"
          className="input max-w-xs"
        />
        {status && <input type="hidden" name="statut" value={status} />}
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={filterHref()}
          className={status ? "btn-secondary" : "btn-primary"}
        >
          Tous
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={filterHref(value)}
            className={status === value ? "btn-primary" : "btn-secondary"}
          >
            {STATUS_LABELS[value]}
          </Link>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        {total} produit{total > 1 ? "s" : ""}
      </p>

      {products.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucun produit trouvé.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Ouvrage</th>
                <th className="px-4 py-3 font-medium">Vendeur</th>
                <th className="px-4 py-3 font-medium">Prix</th>
                <th className="px-4 py-3 font-medium">Ventes</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const suspended = product.status === "SUSPENDED";

                return (
                  <tr key={product.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{product.title}</p>
                      <p className="text-xs text-slate-500">
                        {product.category?.name ?? "Sans catégorie"} · publié le{" "}
                        {formatDate(product.publishedAt)}
                      </p>
                      {product.status === "PUBLISHED" && (
                        <Link
                          href={`/catalogue/${product.slug}`}
                          className="text-xs font-semibold text-brand-700 hover:underline"
                        >
                          Voir la page
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">{product.seller.displayName}</td>
                    <td className="px-4 py-3">
                      {formatPrice(product.priceAmount, product.currency)}
                    </td>
                    <td className="px-4 py-3">{product.salesCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[product.status]}`}
                      >
                        {STATUS_LABELS[product.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={setProductStatusAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={suspended ? "PUBLISHED" : "SUSPENDED"}
                        />
                        <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                          {suspended ? "Rétablir" : "Suspendre"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/produits"
        params={{ q: q || undefined, statut: status }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
                  }
