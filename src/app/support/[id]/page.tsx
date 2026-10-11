// src/app/support/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { closeThreadAction } from "@/app/support/actions";
import { AutoRefresh } from "@/components/paiement/auto-refresh";
import { CheckoutButton } from "@/components/paiement/checkout-button";
import { ReplyForm } from "@/components/support/reply-form";
import { ThreadMessages } from "@/components/support/thread-messages";
import {
  CATEGORY_LABELS,
  STATUS_STYLES,
  USER_STATUS_LABELS,
  formatDateTime,
  requireSupportUser,
  syncThreadPayments,
} from "@/lib/support";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Conversation de support",
};

export const dynamic = "force-dynamic";

function loadThread(threadId: string, userId: string) {
  return prisma.supportThread.findFirst({
    where: { id: threadId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
        include: { sender: { select: { name: true } } },
      },
      payments: {
        where: {
          status: "PENDING",
          createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        select: { id: true },
        take: 1,
      },
    },
  });
}

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  if (!/^[a-z0-9]{1,40}$/i.test(params.id)) {
    notFound();
  }

  const user = await requireSupportUser(`/support/${params.id}`);

  let thread = await loadThread(params.id, user.id);
  if (!thread) {
    notFound();
  }

  // Au retour du paiement, on vérifie auprès de CinetPay (utile si la notification tarde).
  if (thread.status === "AWAITING_PAYMENT" && thread.payments.length > 0) {
    await syncThreadPayments(thread.id);
    thread = await loadThread(params.id, user.id);
    if (!thread) {
      notFound();
    }
  }

  if (thread.status !== "AWAITING_PAYMENT") {
    await prisma.message.updateMany({
      where: { threadId: thread.id, isStaff: true, readAt: null },
      data: { readAt: new Date() },
    });
  }

  const messages = thread.messages.map((message) => ({
    id: message.id,
    isStaff: message.isStaff,
    body: message.body,
    createdAt: message.createdAt,
    senderName: message.sender.name,
  }));

  const hasPendingPayment = thread.payments.length > 0;
  const canReply = thread.status === "OPEN" || thread.status === "ANSWERED";

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/support"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Retour à mes conversations
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
              {USER_STATUS_LABELS[thread.status]}
            </span>
          </div>
        </div>

        {thread.status === "AWAITING_PAYMENT" && (
          <section className="card border-yellow-200 bg-yellow-50">
            {hasPendingPayment && <AutoRefresh />}

            <h2 className="text-lg font-semibold text-yellow-900">
              Paiement requis pour envoyer votre message à l&apos;équipe
            </h2>
            <p className="mt-1 text-sm text-yellow-900">
              Tarif : {formatPrice(thread.feeAmountXof, "XOF")} par Mobile Money.
              L&apos;équipe lit votre message dès la confirmation du paiement.
            </p>

            {hasPendingPayment && (
              <p className="mt-2 text-xs text-yellow-800">
                Si vous venez de payer, la confirmation peut prendre quelques
                instants : cette page se met à jour automatiquement. Validez la
                demande sur votre téléphone si elle n&apos;est pas encore
                apparue.
              </p>
            )}

            <div className="mt-4 max-w-sm">
              <CheckoutButton
                endpoint={`/api/support/${thread.id}/paiement`}
                label={`Payer ${formatPrice(thread.feeAmountXof, "XOF")} par Mobile Money`}
              />
            </div>

            <form action={closeThreadAction} className="mt-4">
              <input type="hidden" name="threadId" value={thread.id} />
              <button
                type="submit"
                className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
              >
                Annuler cette demande
              </button>
            </form>
          </section>
        )}

        <section className="card bg-slate-50">
          <ThreadMessages messages={messages} viewerIsStaff={false} />
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
            <p>
              Cette conversation est clôturée. Pour une nouvelle demande, ouvrez
              une nouvelle conversation.
            </p>
            <div className="mt-4">
              <Link href="/support/nouveau" className="btn-primary">
                Nouvelle conversation
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
