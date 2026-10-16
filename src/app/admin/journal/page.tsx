// src/app/admin/journal/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { AUDIT_CATEGORIES, actionLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/support";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Journal des actions",
};

export const dynamic = "force-dynamic";

function formatDetails(details: unknown): string[] {
  if (typeof details !== "object" || details === null || Array.isArray(details)) {
    return [];
  }

  return Object.entries(details as Record<string, unknown>)
    .slice(0, 12)
    .map(([key, value]) => {
      let text: string;
      if (value === null || value === undefined) text = "-";
      else if (typeof value === "boolean") text = value ? "oui" : "non";
      else if (typeof value === "object") text = JSON.stringify(value).slice(0, 120);
      else text = String(value).slice(0, 160);

      return `${key.replace(/_/g, " ")} : ${text}`;
    });
}

export default async function AdminJournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/journal");

  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  const rawCategory = firstParam(sp.categorie);
  const category = AUDIT_CATEGORIES.find((item) => item.value === rawCategory);

  const where: Prisma.AuditLogWhereInput = {
    ...(q ? { adminEmail: { contains: q, mode: "insensitive" } } : {}),
    ...(category
      ? { OR: category.prefixes.map((prefix) => ({ action: { startsWith: prefix } })) }
      : {}),
  };

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  // Les éléments ciblés sont retrouvés à l'affichage (rien n'est copié dans le journal).
  const idsByType = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.targetType && entry.targetId) {
      const list = idsByType.get(entry.targetType) ?? [];
      if (!list.includes(entry.targetId)) list.push(entry.targetId);
      idsByType.set(entry.targetType, list);
    }
  }

  const targetLabels = new Map<string, string>();
  const remember = (type: string, id: string, label: string) =>
    targetLabels.set(`${type}:${id}`, label);

  const [users, sellers, products, orders, payouts, ads, contacts] = await Promise.all([
    idsByType.has("utilisateur")
      ? prisma.user.findMany({
          where: { id: { in: idsByType.get("utilisateur") } },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
    idsByType.has("vendeur")
      ? prisma.sellerProfile.findMany({
          where: { id: { in: idsByType.get("vendeur") } },
          select: { id: true, displayName: true },
        })
      : Promise.resolve([]),
    idsByType.has("produit")
      ? prisma.product.findMany({
          where: { id: { in: idsByType.get("produit") } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    idsByType.has("commande")
      ? prisma.order.findMany({
          where: { id: { in: idsByType.get("commande") } },
          select: { id: true, number: true },
        })
      : Promise.resolve([]),
    idsByType.has("versement")
      ? prisma.payout.findMany({
          where: { id: { in: idsByType.get("versement") } },
          select: { id: true, amount: true, currency: true },
        })
      : Promise.resolve([]),
    idsByType.has("publicite")
      ? prisma.adSpace.findMany({
          where: { id: { in: idsByType.get("publicite") } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    idsByType.has("contact")
      ? prisma.contactMessage.findMany({
          where: { id: { in: idsByType.get("contact") } },
          select: { id: true, subject: true },
        })
      : Promise.resolve([]),
  ]);

  for (const row of users) remember("utilisateur", row.id, row.email);
  for (const row of sellers) remember("vendeur", row.id, row.displayName);
  for (const row of products) remember("produit", row.id, row.title);
  for (const row of orders) remember("commande", row.id, row.number);
  for (const row of payouts) remember("versement", row.id, formatPrice(row.amount, row.currency));
  for (const row of ads) remember("publicite", row.id, row.name);
  for (const row of contacts) remember("contact", row.id, row.subject);

  function filterHref(next?: string): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (next) search.set("categorie", next);
    const query = search.toString();
    return query ? `/admin/journal?${query}` : "/admin/journal";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Journal des actions d&apos;administration</h1>
        <p className="mt-1 text-sm text-slate-600">
          Historique des actions sensibles : qui, quoi, quand. Aucun mot de passe, code ni
          clé n&apos;y est enregistré.
        </p>
      </div>

      <form method="get" action="/admin/journal" className="flex flex-wrap gap-3">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Email de l'administrateur"
          className="input max-w-xs"
        />
        {category && <input type="hidden" name="categorie" value={category.value} />}
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={filterHref()} className={category ? "btn-secondary" : "btn-primary"}>
          Toutes
        </Link>
        {AUDIT_CATEGORIES.map((item) => (
          <Link
            key={item.value}
            href={filterHref(item.value)}
            className={category?.value === item.value ? "btn-primary" : "btn-secondary"}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        {total} entrée{total > 1 ? "s" : ""}
      </p>

      {entries.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune entrée.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Administrateur</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Élément concerné</th>
                <th className="px-4 py-3 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const targetKey =
                  entry.targetType && entry.targetId
                    ? `${entry.targetType}:${entry.targetId}`
                    : null;
                const targetLabel = targetKey ? targetLabels.get(targetKey) : undefined;
                const details = formatDetails(entry.details);

                return (
                  <tr key={entry.id} className="border-b border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p>{entry.adminEmail}</p>
                      {entry.ipHash && (
                        <p className="text-slate-400">connexion {entry.ipHash.slice(0, 8)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{actionLabel(entry.action)}</td>
                    <td className="px-4 py-3 text-xs">
                      {entry.targetType ? (
                        <>
                          <p className="text-slate-500">{entry.targetType}</p>
                          {entry.targetType === "commande" && entry.targetId && targetLabel ? (
                            <Link
                              href={`/admin/commandes/${entry.targetId}`}
                              className="font-semibold text-brand-700 hover:underline"
                            >
                              {targetLabel}
                            </Link>
                          ) : (
                            <p>{targetLabel ?? (entry.targetId ? "(supprimé)" : "-")}</p>
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {details.length === 0 ? (
                        "-"
                      ) : (
                        <ul className="space-y-0.5">
                          {details.map((line) => (
                            <li key={line} className="break-words">
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/journal"
        params={{ q: q || undefined, categorie: category?.value }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
