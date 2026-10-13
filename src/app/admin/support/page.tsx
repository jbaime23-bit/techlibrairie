// src/app/admin/support/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, ThreadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import {
  CATEGORY_LABELS,
  STAFF_STATUS_LABELS,
  STATUS_STYLES,
  formatDateTime,
} from "@/lib/support";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Support",
};

export const dynamic = "force-dynamic";

type Filter = "OPEN" | "ANSWERED" | "CLOSED" | "ALL";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "OPEN", label: "À traiter" },
  { value: "ANSWERED", label: "Répondues" },
  { value: "CLOSED", label: "Clôturées" },
  { value: "ALL", label: "Toutes (payées)" },
];

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/support");

  const rawFilter = firstParam(sp.statut);
  const filter: Filter =
    FILTERS.find((option) => option.value === rawFilter)?.value ?? "OPEN";

  // Les conversations non payées ne sont jamais montrées à l'équipe.
  const statuses: ThreadStatus[] =
    filter === "ALL" ? ["OPEN", "ANSWERED", "CLOSED"] : [filter];

  const where: Prisma.SupportThreadWhereInput = { status: { in: statuses } };

  const total = await prisma.supportThread.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const threads = await prisma.supportThread.findMany({
    where,
    orderBy: { lastMessageAt: filter === "OPEN" ? "asc" : "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    include: {
      user: { select: { name: true, email: true, role: true } },
      assignedTo: { select: { name: true } },
    },
  });

  const unread = await prisma.message.groupBy({
    by: ["threadId"],
    where: {
      threadId: { in: threads.map((thread) => thread.id) },
      isStaff: false,
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadByThread = new Map(unread.map((row) => [row.threadId, row._count._all]));

  const revenue = await prisma.supportPayment.aggregate({
    where: { status: "SUCCEEDED" },
    _sum: { amount: true },
    _count: { _all: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm text-slate-600">
          Revenus du support : {formatPrice(revenue._sum.amount ?? 0, "XOF")} (
          {revenue._count._all} paiement{revenue._count._all > 1 ? "s" : ""})
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={
              option.value === "OPEN"
                ? "/admin/support"
                : `/admin/support?statut=${option.value}`
            }
            className={filter === option.value ? "btn-primary" : "btn-secondary"}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        {total} conversation{total > 1 ? "s" : ""}
      </p>

      {threads.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune conversation.</div>
      ) : (
        <ul className="space-y-3">
          {threads.map((thread) => {
            const unreadCount = unreadByThread.get(thread.id) ?? 0;

            return (
              <li key={thread.id}>
                <Link
                  href={`/admin/support/${thread.id}`}
                  className="card flex flex-wrap items-center justify-between gap-3 transition hover:shadow-md"
                >
                  <div>
                    <p className="font-semibold">{thread.subject}</p>
                    <p className="text-xs text-slate-500">
                      {thread.user.name ?? "Sans nom"} · {thread.user.email} ·{" "}
                      {thread.user.role === "SELLER" ? "Vendeur" : "Acheteur"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {thread.number} · {CATEGORY_LABELS[thread.category]} · dernier
                      message le {formatDateTime(thread.lastMessageAt)}
                      {thread.assignedTo
                        ? ` · pris en charge par ${thread.assignedTo.name ?? "un administrateur"}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                        {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
                      </span>
                    )}
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[thread.status]}`}
                    >
                      {STAFF_STATUS_LABELS[thread.status]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        basePath="/admin/support"
        params={{ statut: filter === "OPEN" ? undefined : filter }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
      }
