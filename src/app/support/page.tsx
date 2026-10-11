// src/app/support/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import {
  CATEGORY_LABELS,
  STATUS_STYLES,
  USER_STATUS_LABELS,
  formatDateTime,
  getSupportFeeXof,
  requireSupportUser,
} from "@/lib/support";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Support",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = Math.min(ADMIN_PAGE_SIZE, 10);

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireSupportUser("/support");

  const [fee, total] = await Promise.all([
    getSupportFeeXof(),
    prisma.supportThread.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(searchParams.page), totalPages);

  const threads = await prisma.supportThread.findMany({
    where: { userId: user.id },
    orderBy: { lastMessageAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      number: true,
      subject: true,
      category: true,
      status: true,
      lastMessageAt: true,
    },
  });

  const unread = await prisma.message.groupBy({
    by: ["threadId"],
    where: {
      threadId: { in: threads.map((thread) => thread.id) },
      isStaff: true,
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadByThread = new Map(unread.map((row) => [row.threadId, row._count._all]));

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="mt-1 text-sm text-slate-600">
            {fee === 0
              ? "Posez votre question à l'équipe TechLibrairie : le support est actuellement gratuit."
              : `Posez votre question à l'équipe TechLibrairie. Tarif d'une conversation : ${formatPrice(fee, "XOF")}, payable par Mobile Money.`}
          </p>
        </div>
        <Link href="/support/nouveau" className="btn-primary">
          Nouvelle conversation
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        {total} conversation{total > 1 ? "s" : ""}
      </p>

      {threads.length === 0 ? (
        <div className="card mt-4 text-center text-sm text-slate-600">
          <p>Vous n&apos;avez pas encore contacté le support.</p>
          <div className="mt-4">
            <Link href="/support/nouveau" className="btn-primary">
              Ouvrir une conversation
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {threads.map((thread) => {
            const unreadCount = unreadByThread.get(thread.id) ?? 0;

            return (
              <li key={thread.id}>
                <Link
                  href={`/support/${thread.id}`}
                  className="card flex flex-wrap items-center justify-between gap-3 transition hover:shadow-md"
                >
                  <div>
                    <p className="font-semibold">{thread.subject}</p>
                    <p className="text-xs text-slate-500">
                      {thread.number} · {CATEGORY_LABELS[thread.category]} · dernier
                      message le {formatDateTime(thread.lastMessageAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                        {unreadCount} nouveau{unreadCount > 1 ? "x" : ""}
                      </span>
                    )}
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[thread.status]}`}
                    >
                      {USER_STATUS_LABELS[thread.status]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination basePath="/support" params={{}} page={page} totalPages={totalPages} />
    </div>
  );
}
