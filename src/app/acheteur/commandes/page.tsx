// src/app/acheteur/commandes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam, parsePage } from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { OrderItemRow } from "@/components/acheteur/order-item-row";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mes commandes",
};

export const dynamic = "force-dynamic";

const BUYER_PAGE_SIZE = 10;

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente de paiement",
  PAID: "Payée",
  FAILED: "Paiement échoué",
  CANCELED: "Annulée",
  REFUNDED: "Remboursée",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELED: "bg-slate-100 text-slate-700",
  REFUNDED: "bg-purple-100 text-purple-800",
};

const LINK_MESSAGES: Record<string, { text: string; success: boolean }> = {
  ok: { text: "Un nouveau lien de téléchargement a été généré.", success: true },
  valide: {
    text: "Votre lien actuel est encore valide : utilisez le bouton « Télécharger le PDF ».",
    success: false,
  },
  limite: {
    text: "Trop de liens ont été générés aujourd'hui pour cet ouvrage. Réessayez demain ou contactez-nous.",
    success: false,
  },
  invalide: { text: "Ouvrage introuvable.", success: false },
};

export default async function AcheteurCommandesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser("/acheteur/commandes");

  const where = { buyerId: user.id };

  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / BUYER_PAGE_SIZE));
  const page = Math.min(parsePage(searchParams.page), totalPages);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * BUYER_PAGE_SIZE,
    take: BUYER_PAGE_SIZE,
    include: {
      items: {
        include: {
          downloads: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              token: true,
              expiresAt: true,
              maxDownloads: true,
              downloadCount: true,
            },
          },
        },
      },
    },
  });

  const messageKey = firstParam(searchParams.lien);
  const message = messageKey ? LINK_MESSAGES[messageKey] : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mes commandes</h1>

      {message && (
        <div
          className={
            message.success
              ? "rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              : "alert-error"
          }
        >
          {message.text}
        </div>
      )}

      <p className="text-sm text-slate-600">
        {total} commande{total > 1 ? "s" : ""}
      </p>

      {orders.length === 0 ? (
        <div className="card text-center text-sm text-slate-600">
          <p>Vous n&apos;avez pas encore passé de commande.</p>
          <div className="mt-4">
            <Link href="/catalogue" className="btn-primary">
              Parcourir le catalogue
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Commande {order.number}</p>
                  <p className="text-xs text-slate-500">
                    Passée le {formatDate(order.createdAt)}
                    {order.paidAt ? ` · payée le ${formatDate(order.paidAt)}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold">
                    {formatPrice(order.totalAmount, order.currency)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[order.status]}`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </div>

              {order.status === "PAID" ? (
                <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                  {order.items.map((item) => (
                    <OrderItemRow key={item.id} item={item} returnTo="commandes" />
                  ))}
                </ul>
              ) : (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <ul className="space-y-1 text-sm text-slate-700">
                    {order.items.map((item) => (
                      <li key={item.id}>{item.productTitle}</li>
                    ))}
                  </ul>

                  {order.status === "PENDING" && (
                    <div className="mt-3">
                      <Link
                        href={`/paiement/retour?commande=${order.id}`}
                        className="btn-secondary"
                      >
                        Vérifier le paiement
                      </Link>
                    </div>
                  )}

                  {(order.status === "FAILED" || order.status === "CANCELED") && (
                    <p className="mt-3 text-xs text-slate-500">
                      Cette commande n&apos;a pas abouti et vous n&apos;avez pas été
                      débité. Vous pouvez recommencer depuis le catalogue.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/acheteur/commandes"
        params={{}}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
