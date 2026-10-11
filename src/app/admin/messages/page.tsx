// src/app/admin/messages/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { ContactStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { setContactStatusAction } from "@/app/admin/actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Messages de contact",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ContactStatus, string> = {
  NEW: "Nouveau",
  READ: "Lu",
  ANSWERED: "Répondu",
  ARCHIVED: "Archivé",
};

const STATUS_STYLES: Record<ContactStatus, string> = {
  NEW: "bg-brand-100 text-brand-800",
  READ: "bg-slate-100 text-slate-700",
  ANSWERED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-slate-200 text-slate-600",
};

const STATUSES: ContactStatus[] = ["NEW", "READ", "ANSWERED", "ARCHIVED"];

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/messages");

  const rawStatus = firstParam(searchParams.statut);
  const status = STATUSES.find((value) => value === rawStatus);

  // Par défaut : tous les messages sauf les archivés.
  const where: Prisma.ContactMessageWhereInput = status
    ? { status }
    : { status: { not: "ARCHIVED" } };

  const total = await prisma.contactMessage.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(searchParams.page), totalPages);

  const messages = await prisma.contactMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Messages de contact</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/messages"
          className={status ? "btn-secondary" : "btn-primary"}
        >
          Tous (hors archivés)
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`/admin/messages?statut=${value}`}
            className={status === value ? "btn-primary" : "btn-secondary"}
          >
            {STATUS_LABELS[value]}
          </Link>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        {total} message{total > 1 ? "s" : ""}
      </p>

      {messages.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucun message.</div>
      ) : (
        <ul className="space-y-4">
          {messages.map((message) => (
            <li key={message.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{message.subject}</p>
                  <p className="text-sm text-slate-600">
                    {message.name} ·{" "}
                    <a
                      href={`mailto:${message.email}?subject=${encodeURIComponent(
                        `Re: ${message.subject}`
                      )}`}
                      className="text-brand-700 hover:underline"
                    >
                      {message.email}
                    </a>
                    {message.phone && (
                      <>
                        {" · "}
                        <a
                          href={`tel:${message.phone.replace(/\s/g, "")}`}
                          className="text-brand-700 hover:underline"
                        >
                          {message.phone}
                        </a>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    Reçu le {formatDate(message.createdAt)}
                  </p>
                </div>

                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[message.status]}`}
                >
                  {STATUS_LABELS[message.status]}
                </span>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm text-slate-800">
                {message.message}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`mailto:${message.email}?subject=${encodeURIComponent(
                    `Re: ${message.subject}`
                  )}`}
                  className="btn-primary px-3 py-1 text-xs"
                >
                  Répondre par email
                </a>

                {STATUSES.filter((value) => value !== message.status).map((value) => (
                  <form key={value} action={setContactStatusAction}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="status" value={value} />
                    <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                      Marquer : {STATUS_LABELS[value]}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/admin/messages"
        params={{ statut: status }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
