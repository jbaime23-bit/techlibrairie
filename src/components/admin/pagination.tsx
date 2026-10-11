// src/components/admin/pagination.tsx
import Link from "next/link";

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  function buildHref(targetPage: number): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center justify-center gap-4 text-sm"
    >
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className="btn-secondary">
          Précédent
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-50">
          Précédent
        </span>
      )}

      <span className="text-slate-600">
        Page {page} sur {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className="btn-secondary">
          Suivant
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-50">
          Suivant
        </span>
      )}
    </nav>
  );
}
