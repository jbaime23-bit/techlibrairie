// src/app/admin/support/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { closeThreadAction, reopenThreadAction } from "@/app/support/actions";
import { ReplyForm } from "@/components/support/reply-form";
import { ThreadMessages } from "@/components/support/thread-messages";
import {
  CATEGORY_LABELS,
  STAFF_STATUS_LABELS,
  STATUS_STYLES,
  formatDateTime,
} from "@/lib/support";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Conversation de support",
};

export const dynamic = "force-dynamic";

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    notFound();
  }

  await requireAdmin(`/admin/support/${id}`);

  const thread = await prisma.supportThread.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true, role: true } },
      assignedTo: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
        include: { sender: { select: { name: true } } },
      },
    },
  });

  if (!thread) {
    notFound();
  }

  // Une conversation non payée n'est pas lisible par l'équipe.
  if (thread.status === "AWAITING_PAYMENT") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card text-center">
          <h1 className="text-xl font-bold">Conversation non payée</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cette conversation ({thread.number}) attend le paiement de
            l&apos;utilisateur. Son contenu sera visible après paiement.
          </p>
          <div className="mt-6">
            <Link href="/admin/support" className="btn-secondary">
              Retour au support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  await prisma.message.updateMany({
    where: { threadId: thread.id, isStaff: false, readAt: null },
    data: { readAt: new Date() },
  });

  const messages = thread.messages.map((message) => ({
    id: message.id,
    isStaff: message.isStaff,
    body: message.body,
    createdAt: message.createdAt,
    senderName: message.sender.name,
  }));

  const canReply = thread.status === "OPEN" || thread.status === "ANSWERED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/support"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          Retour au support
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{thread.subject}</h1>
            <p className="text-xs text-slate-500">
              {thread.number} · {CATEGORY_LABELS[thread.category]} · ouverte le{" "}
              {formatDateTime(thread.createdAt)}
            </p>
          </div>
          <span
            className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[thread.status]}`}
          >
            {STAFF_STATUS_LABELS[thread.status]}
          </span>
        </div>
      </div>

      <section className="card text-sm">
        <p className="font-semibold">{thread.user.name ?? "Sans nom"}</p>
        <p className="text-slate-600">
          <a
            href={`mailto:${thread.user.email}`}
            className="text-brand-700 hover:underline"
          >
            {thread.user.email}
          </a>
          {thread.user.phone ? ` · ${thread.user.phone}` : ""} ·{" "}
          {thread.user.role === "SELLER" ? "Vendeur" : "Acheteur"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Tarif : {formatPrice(thread.feeAmountXof, "XOF")}
          {thread.paidAt ? ` · payé le ${formatDateTime(thread.paidAt)}` : ""}
          {thread.assignedTo
            ? ` · pris en charge par ${thread.assignedTo.name ?? "un administrateur"}`
            : ""}
        </p>
      </section>

      <section className="card bg-slate-50">
        <ThreadMessages messages={messages} viewerIsStaff />
      </section>

      {canReply && (
        <section className="card">
          <ReplyForm threadId={thread.id} />

          <form action={closeThreadAction} className="mt-4">
            <input type="hidden" name="threadId" value={thread.id} />
            <button
              type="submit"
              className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
            >
              Clôturer la conversation
            </button>
          </form>
        </section>
      )}

      {thread.status === "CLOSED" && (
        <section className="card text-center text-sm text-slate-600">
          <p>Cette conversation est clôturée.</p>
          <form action={reopenThreadAction} className="mt-4">
            <input type="hidden" name="threadId" value={thread.id} />
            <button type="submit" className="btn-secondary">
              Rouvrir la conversation
            </button>
          </form>
        </section>
      )}
    </div>
  );
          }
